const express = require('express');
const crypto = require('crypto');
const { get, all, run, asyncHandler } = require('../db-helpers');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asString, isPhone, isPincode, parsePositiveInt } = require('../validation');
const { deliverOtp, shouldShowDemoOtp } = require('../services/otp-sender');

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

router.post('/otp/request', requireAuth, asyncHandler(async (req, res) => {
  const phone = asString(req.body.phone, 20);
  if (!phone || !isPhone(phone)) {
    return res.status(400).json({ error: 'Valid phone number required for OTP' });
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const salt = crypto.randomBytes(16).toString('hex');
  let delivery;

  try {
    delivery = await deliverOtp(phone, code, OTP_TTL_MINUTES);
  } catch (err) {
    console.error('[OTP]', err.message);
    return res.status(503).json({ error: 'OTP delivery is not configured. Please contact admin.' });
  }

  await run("UPDATE checkout_otps SET used_at = datetime('now') WHERE client_id = ? AND used_at IS NULL", [req.client.id]);
  const created = await run(
    `INSERT INTO checkout_otps (client_id, phone, otp_hash, otp_salt, expires_at)
     VALUES (?, ?, ?, ?, datetime('now', ?))`,
    [req.client.id, phone, hashOtp(code, salt), salt, `+${OTP_TTL_MINUTES} minutes`]
  );

  const response = {
    success: true,
    challenge_id: created.lastInsertRowid,
    expires_in_minutes: OTP_TTL_MINUTES
  };
  if (shouldShowDemoOtp()) {
    response.dev_otp = code;
  }
  if (delivery.mode !== 'demo') response.delivery = delivery.mode;
  res.json(response);
}));

router.post('/otp/verify', requireAuth, asyncHandler(async (req, res) => {
  const challengeId = parsePositiveInt(req.body.challenge_id);
  const otp = asString(req.body.otp, 6);
  if (!challengeId || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'Valid OTP required' });
  }

  const challenge = await get(
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

  await run("UPDATE checkout_otps SET verified_at = datetime('now') WHERE id = ?", [challengeId]);
  res.json({ success: true });
}));

router.post('/', requireAuth, asyncHandler(async (req, res) => {
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

  const otpChallenge = await get(
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

    const priced = await get(
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

  for (const item of cleanItems) {
    const stockRow = await get('SELECT stock FROM product_stock WHERE product_id = ?', [item.product_id]);
    const available = stockRow ? stockRow.stock : 0;
    if (available < item.qty) {
      return res.status(400).json({ error: `Insufficient stock for ${item.product_name}` });
    }
  }

  subtotal = Math.round(subtotal * 100) / 100;
  const settings = await get('SELECT free_shipping_above, shipping_charge FROM settings LIMIT 1');
  const freeShippingAbove = settings?.free_shipping_above || 5000;
  const shippingCharge = settings?.shipping_charge || 199;
  const shipping = subtotal >= freeShippingAbove ? 0 : shippingCharge;
  const coupon_code = asString(req.body.coupon_code, 32).toUpperCase();
  let discount_amount = 0;
  if (coupon_code) {
    const coupon = await get(
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

  const created = await run(
    `INSERT INTO orders (client_id, client_name, client_email, client_phone, shipping_address, shipping_city, shipping_state, shipping_pincode, items_count, subtotal, shipping, discount_amount, coupon_code, total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.client.id, name, req.client.email, phone, address, city, state, pincode, cleanItems.length, subtotal, shipping, discount_amount, coupon_code, total]
  );

  const order = await get('SELECT * FROM orders WHERE id = ?', [created.lastInsertRowid]);
  if (!order) return res.status(500).json({ error: 'Failed to create order' });

  for (const item of cleanItems) {
    await run('INSERT INTO order_items (order_id, product_id, product_name, price, qty) VALUES (?, ?, ?, ?, ?)',
      [order.id, item.product_id, item.product_name, item.price, item.qty]);
    const existingStock = await get('SELECT stock FROM product_stock WHERE product_id = ?', [item.product_id]);
    if (existingStock) {
      await run('UPDATE product_stock SET stock = MAX(0, stock - ?) WHERE product_id = ?', [item.qty, item.product_id]);
    }
  }

  if (coupon_code) {
    await run("UPDATE coupons SET used_count = used_count + 1 WHERE code = ? AND is_active = 1", [coupon_code]);
  }
  await run("UPDATE checkout_otps SET used_at = datetime('now') WHERE id = ?", [challengeId]);

  order.items = await all('SELECT * FROM order_items WHERE order_id = ?', [order.id]);

  res.status(201).json({ success: true, order });
}));

router.get('/my', requireAuth, asyncHandler(async (req, res) => {
  const orders = await all('SELECT * FROM orders WHERE client_id = ? ORDER BY created_at DESC', [req.client.id]);
  for (const o of orders) {
    o.items = await all('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
  }
  res.json({ orders });
}));

router.get('/admin/all', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const orders = await all('SELECT * FROM orders ORDER BY created_at DESC');
  for (const o of orders) {
    o.items = await all('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
    const client = await get('SELECT id, name, email, tier FROM clients WHERE id = ?', [o.client_id]);
    o.client = client || null;
  }
  res.json({ orders });
}));

router.put('/admin/:id/status', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { status } = req.body;
  const orderId = parsePositiveInt(req.params.id);
  if (!orderId) return res.status(400).json({ error: 'Invalid order id' });
  const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') });
  }
  const existing = await get('SELECT id FROM orders WHERE id = ?', [orderId]);
  if (!existing) return res.status(404).json({ error: 'Order not found' });
  await run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
  const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
  res.json({ success: true, order });
}));

module.exports = router;
