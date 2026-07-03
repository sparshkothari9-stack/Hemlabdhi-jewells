const express = require('express');
const crypto = require('crypto');
const { get, all, run } = require('../db-helpers');
const { requireAuth } = require('../middleware/auth');
const { asString, isPhone, isPincode, parsePositiveInt } = require('../validation');

const router = express.Router();
const OTP_TTL_MINUTES = 10;

function hashOtp(code, salt) {
  return crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

function isExpired(value) {
  return new Date(`${value}Z`).getTime() <= Date.now();
}

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

router.post('/otp/request', requireAuth, (req, res) => {
  const phone = asString(req.body.phone, 20);
  if (!phone || !isPhone(phone)) {
    return res.status(400).json({ error: 'Valid phone number required for OTP' });
  }

  run("UPDATE checkout_otps SET used_at = datetime('now') WHERE client_id = ? AND used_at IS NULL", [req.client.id]);

  const code = String(crypto.randomInt(100000, 1000000));
  const salt = crypto.randomBytes(16).toString('hex');
  const created = run(
    `INSERT INTO checkout_otps (client_id, phone, otp_hash, otp_salt, expires_at)
     VALUES (?, ?, ?, ?, datetime('now', ?))`,
    [req.client.id, phone, hashOtp(code, salt), salt, `+${OTP_TTL_MINUTES} minutes`]
  );

  const response = {
    success: true,
    challenge_id: created.lastInsertRowid,
    expires_in_minutes: OTP_TTL_MINUTES
  };
  if (process.env.NODE_ENV !== 'production' || process.env.SHOW_DEMO_OTP === 'true') {
    response.dev_otp = code;
  }
  res.json(response);
});

router.post('/otp/verify', requireAuth, (req, res) => {
  const challengeId = parsePositiveInt(req.body.challenge_id);
  const otp = asString(req.body.otp, 6);
  if (!challengeId || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'Valid OTP required' });
  }

  const challenge = get(
    'SELECT * FROM checkout_otps WHERE id = ? AND client_id = ? AND used_at IS NULL',
    [challengeId, req.client.id]
  );
  if (!challenge || isExpired(challenge.expires_at)) {
    return res.status(400).json({ error: 'OTP expired. Please request a new OTP.' });
  }

  const submittedHash = hashOtp(otp, challenge.otp_salt);
  if (!safeEqual(submittedHash, challenge.otp_hash)) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }

  run("UPDATE checkout_otps SET verified_at = datetime('now') WHERE id = ?", [challengeId]);
  res.json({ success: true });
});

router.post('/', requireAuth, (req, res) => {
  const name = asString(req.body.name, 120);
  const phone = asString(req.body.phone, 20);
  const address = asString(req.body.address, 500);
  const city = asString(req.body.city, 80);
  const state = asString(req.body.state, 80);
  const pincode = asString(req.body.pincode, 12);
  const challengeId = parsePositiveInt(req.body.otp_challenge_id);
  const items = req.body.items;

  if (!name || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!phone || !isPhone(phone)) return res.status(400).json({ error: 'Valid phone number required' });
  if (!address || !city || !state || !isPincode(pincode)) {
    return res.status(400).json({ error: 'Valid shipping address and pincode are required' });
  }
  if (items.length > 50) return res.status(400).json({ error: 'Too many order items' });
  if (!challengeId) return res.status(400).json({ error: 'Please verify OTP before placing order' });

  const otpChallenge = get(
    `SELECT * FROM checkout_otps
     WHERE id = ? AND client_id = ? AND phone = ? AND verified_at IS NOT NULL AND used_at IS NULL`,
    [challengeId, req.client.id, phone]
  );
  if (!otpChallenge || isExpired(otpChallenge.expires_at)) {
    return res.status(400).json({ error: 'Please verify OTP before placing order' });
  }

  const cleanItems = [];
  let subtotal = 0;

  for (const item of items) {
    const productId = parsePositiveInt(item.product_id || item.id);
    const qty = parsePositiveInt(item.qty, 99);
    if (!productId || !qty) return res.status(400).json({ error: 'Invalid order item' });

    const priced = get(
      `SELECT products.id, products.name, pricing.price
       FROM products
       JOIN pricing ON pricing.product_id = products.id
       WHERE products.id = ? AND pricing.client_id = ?`,
      [productId, req.client.id]
    );

    if (!priced) {
      return res.status(400).json({ error: `Product ${productId} is not available for this client` });
    }

    cleanItems.push({
      product_id: priced.id,
      product_name: priced.name,
      price: Number(priced.price),
      qty
    });
    subtotal += Number(priced.price) * qty;
  }

  subtotal = Math.round(subtotal * 100) / 100;
  const shipping = subtotal >= 5000 ? 0 : 199;
  const coupon_code = asString(req.body.coupon_code, 32).toUpperCase();
  let discount_amount = 0;
  if (coupon_code) {
    const coupon = get(
      `SELECT * FROM coupons
       WHERE code = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))`,
      [coupon_code]
    );
    if (!coupon) return res.status(400).json({ error: 'Invalid or expired coupon' });
    if (coupon.used_count >= coupon.max_uses) return res.status(400).json({ error: 'Coupon usage limit reached' });
    if (subtotal < coupon.min_amount) return res.status(400).json({ error: `Minimum order amount is ₹${coupon.min_amount}` });
    discount_amount = Math.round(subtotal * coupon.discount_percent / 100);
  }
  const total = Math.round((subtotal + shipping - discount_amount) * 100) / 100;
  if (total < 0) return res.status(400).json({ error: 'Invalid order total' });

  const created = run(
    `INSERT INTO orders (client_id, client_name, client_email, client_phone, shipping_address, shipping_city, shipping_state, shipping_pincode, items_count, subtotal, shipping, discount_amount, coupon_code, total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.client.id, name, req.client.email, phone, address, city, state, pincode, cleanItems.length, subtotal, shipping, discount_amount, coupon_code, total]
  );

  const order = get('SELECT * FROM orders WHERE id = ?', [created.lastInsertRowid]);
  if (!order) return res.status(500).json({ error: 'Failed to create order' });

  const stmt = `INSERT INTO order_items (order_id, product_id, product_name, price, qty) VALUES (?, ?, ?, ?, ?)`;
  for (const item of cleanItems) {
    run(stmt, [order.id, item.product_id, item.product_name, item.price, item.qty]);
    const existingStock = get('SELECT stock FROM product_stock WHERE product_id = ?', [item.product_id]);
    if (existingStock) {
      run('UPDATE product_stock SET stock = MAX(0, stock - ?) WHERE product_id = ?', [item.qty, item.product_id]);
    }
  }

  if (coupon_code) {
    run("UPDATE coupons SET used_count = used_count + 1 WHERE code = ? AND is_active = 1", [coupon_code]);
  }
  run("UPDATE checkout_otps SET used_at = datetime('now') WHERE id = ?", [challengeId]);

  order.items = all('SELECT * FROM order_items WHERE order_id = ?', [order.id]);

  res.status(201).json({ success: true, order });
});

router.get('/my', requireAuth, (req, res) => {
  const orders = all('SELECT * FROM orders WHERE client_id = ? ORDER BY created_at DESC', [req.client.id]);
  for (const o of orders) {
    o.items = all('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
  }
  res.json({ orders });
});

// === Admin order routes ===
const { requireAdmin } = require('../middleware/auth');

router.get('/admin/all', requireAuth, requireAdmin, (req, res) => {
  const orders = all('SELECT * FROM orders ORDER BY created_at DESC');
  for (const o of orders) {
    o.items = all('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
    const client = get('SELECT id, name, email, tier FROM clients WHERE id = ?', [o.client_id]);
    o.client = client || null;
  }
  res.json({ orders });
});

router.put('/admin/:id/status', requireAuth, requireAdmin, (req, res) => {
  const { status } = req.body;
  const orderId = parsePositiveInt(req.params.id);
  if (!orderId) return res.status(400).json({ error: 'Invalid order id' });
  const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') });
  }
  const existing = get('SELECT id FROM orders WHERE id = ?', [orderId]);
  if (!existing) return res.status(404).json({ error: 'Order not found' });
  run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
  const order = get('SELECT * FROM orders WHERE id = ?', [orderId]);
  res.json({ success: true, order });
});

module.exports = router;
