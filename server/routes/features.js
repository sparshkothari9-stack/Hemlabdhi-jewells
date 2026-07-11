const express = require('express');
const { get, all, run, asyncHandler } = require('../db-helpers');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asString, sanitize, parsePositiveInt } = require('../validation');

const router = express.Router();

router.get('/stock', requireAuth, asyncHandler(async (req, res) => {
  const stock = await all('SELECT product_id, stock, low_stock_threshold FROM product_stock');
  const map = {};
  for (const s of stock) map[s.product_id] = s;
  res.json({ stock: map });
}));

router.put('/stock', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { stock } = req.body;
  if (!stock || typeof stock !== 'object') return res.status(400).json({ error: 'Stock object required' });
  for (const [productId, data] of Object.entries(stock)) {
    const pid = parsePositiveInt(productId);
    if (!pid) continue;
    const qty = parsePositiveInt(data.stock);
    const threshold = parsePositiveInt(data.low_stock_threshold) || 3;
    const existing = await get('SELECT product_id FROM product_stock WHERE product_id = ?', [pid]);
    if (existing) {
      await run('UPDATE product_stock SET stock = ?, low_stock_threshold = ? WHERE product_id = ?', [qty, threshold, pid]);
    } else if (qty !== null) {
      await run('INSERT INTO product_stock (product_id, stock, low_stock_threshold) VALUES (?, ?, ?)', [pid, qty, threshold]);
    }
  }
  res.json({ success: true });
}));

router.get('/orders/:id/notes', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const orderId = parsePositiveInt(req.params.id);
  if (!orderId) return res.status(400).json({ error: 'Invalid order id' });
  const notes = await all('SELECT * FROM order_notes WHERE order_id = ? ORDER BY created_at DESC', [orderId]);
  res.json({ notes });
}));

router.post('/orders/:id/notes', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const orderId = parsePositiveInt(req.params.id);
  if (!orderId) return res.status(400).json({ error: 'Invalid order id' });
  const note = sanitize(asString(req.body.note, 1000));
  if (!note) return res.status(400).json({ error: 'Note required' });
  await run('INSERT INTO order_notes (order_id, note) VALUES (?, ?)', [orderId, note]);
  res.json({ success: true });
}));

router.put('/orders/:id/tracking', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const orderId = parsePositiveInt(req.params.id);
  if (!orderId) return res.status(400).json({ error: 'Invalid order id' });
  const tracking = asString(req.body.tracking_number, 200);
  await run('UPDATE orders SET tracking_number = ? WHERE id = ?', [tracking, orderId]);
  res.json({ success: true });
}));

router.get('/dashboard', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const totalOrders = (await get('SELECT COUNT(*) as c FROM orders'))?.c || 0;
  const totalRevenue = (await get(`SELECT COALESCE(SUM(total),0) as c FROM orders WHERE status != 'cancelled'`))?.c || 0;
  const pendingOrders = (await get("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'"))?.c || 0;
  const totalClients = (await get('SELECT COUNT(*) as c FROM clients WHERE is_admin = 0'))?.c || 0;
  const totalProducts = (await get('SELECT COUNT(*) as c FROM products'))?.c || 0;
  const lowStock = await all(`SELECT p.id, p.name, ps.stock FROM products p JOIN product_stock ps ON ps.product_id = p.id WHERE ps.stock <= ps.low_stock_threshold ORDER BY ps.stock LIMIT 5`);
  const recentOrders = await all('SELECT id, client_name, total, status, created_at FROM orders ORDER BY created_at DESC LIMIT 5');
  const revenueByMonth = await all(`SELECT strftime('%Y-%m', created_at) as month, COALESCE(SUM(total),0) as revenue FROM orders WHERE status != 'cancelled' GROUP BY month ORDER BY month DESC LIMIT 6`);
  const topProducts = await all(`SELECT oi.product_name, SUM(oi.qty) as qty, SUM(oi.qty * oi.price) as revenue FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status != 'cancelled' GROUP BY oi.product_name ORDER BY qty DESC LIMIT 5`);
  res.json({ totalOrders, totalRevenue, pendingOrders, totalClients, totalProducts, lowStock, recentOrders, revenueByMonth, topProducts });
}));

router.post('/enquiries', asyncHandler(async (req, res) => {
  const name = sanitize(asString(req.body.name, 120));
  const email = sanitize(asString(req.body.email, 254));
  const phone = sanitize(asString(req.body.phone, 20));
  const products = sanitize(asString(req.body.products, 2000));
  const message = sanitize(asString(req.body.message, 2000));
  if (!name || !email || !products) return res.status(400).json({ error: 'Name, email, and products required' });
  const clientId = req.client?.id || null;
  await run('INSERT INTO enquiries (client_id, client_name, client_email, client_phone, products, message) VALUES (?, ?, ?, ?, ?, ?)',
    [clientId, name, email, phone, products, message]);
  res.json({ success: true });
}));

router.get('/enquiries', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const enquiries = await all('SELECT * FROM enquiries ORDER BY created_at DESC');
  res.json({ enquiries });
}));

router.put('/enquiries/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  const status = asString(req.body.status, 32);
  if (!['pending', 'contacted', 'quoted', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  await run('UPDATE enquiries SET status = ? WHERE id = ?', [status, id]);
  res.json({ success: true });
}));

router.get('/coupons', requireAuth, asyncHandler(async (req, res) => {
  if (req.client?.is_admin) {
    return res.json({ coupons: await all('SELECT * FROM coupons ORDER BY created_at DESC') });
  }
  const coupons = await all("SELECT code, discount_percent, min_amount FROM coupons WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))");
  res.json({ coupons });
}));

router.post('/coupons', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const code = sanitize(asString(req.body.code, 32).toUpperCase().replace(/\s+/g, ''));
  const discount_percent = Math.min(100, Math.max(1, parseInt(req.body.discount_percent) || 10));
  const min_amount = Math.max(0, parseFloat(req.body.min_amount) || 0);
  const max_uses = Math.max(1, parseInt(req.body.max_uses) || 100);
  const expires_at = req.body.expires_at || null;
  if (!code) return res.status(400).json({ error: 'Coupon code required' });
  if (await get('SELECT id FROM coupons WHERE code = ?', [code])) {
    return res.status(409).json({ error: 'Coupon code already exists' });
  }
  const created = await run('INSERT INTO coupons (code, discount_percent, min_amount, max_uses, expires_at) VALUES (?, ?, ?, ?, ?)',
    [code, discount_percent, min_amount, max_uses, expires_at]);
  res.json({ coupon: await get('SELECT * FROM coupons WHERE id = ?', [created.lastInsertRowid]) });
}));

router.put('/coupons/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  const existing = await get('SELECT id FROM coupons WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Coupon not found' });
  const fields = [];
  const vals = [];
  for (const key of ['discount_percent', 'min_amount', 'max_uses', 'is_active']) {
    if (req.body[key] !== undefined) {
      if (key === 'discount_percent') { fields.push('discount_percent = ?'); vals.push(Math.min(100, Math.max(1, parseInt(req.body[key])))); }
      else if (key === 'min_amount') { fields.push('min_amount = ?'); vals.push(Math.max(0, parseFloat(req.body[key]))); }
      else if (key === 'max_uses') { fields.push('max_uses = ?'); vals.push(Math.max(1, parseInt(req.body[key]))); }
      else if (key === 'is_active') { fields.push('is_active = ?'); vals.push(req.body[key] ? 1 : 0); }
    }
  }
  if (req.body.code) { fields.push('code = ?'); vals.push(asString(req.body.code, 32).toUpperCase()); }
  if (req.body.expires_at !== undefined) { fields.push('expires_at = ?'); vals.push(req.body.expires_at || null); }
  if (fields.length > 0) {
    vals.push(id);
    await run(`UPDATE coupons SET ${fields.join(', ')} WHERE id = ?`, vals);
  }
  res.json({ coupon: await get('SELECT * FROM coupons WHERE id = ?', [id]) });
}));

router.post('/coupons/validate', requireAuth, asyncHandler(async (req, res) => {
  const code = asString(req.body.code, 32).toUpperCase().replace(/\s+/g, '');
  const amount = Math.max(0, parseFloat(req.body.amount) || 0);
  if (!code) return res.status(400).json({ error: 'Coupon code required' });
  const coupon = await get(`SELECT * FROM coupons WHERE code = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))`, [code]);
  if (!coupon) return res.status(404).json({ error: 'Invalid or expired coupon' });
  if (coupon.used_count >= coupon.max_uses) return res.status(400).json({ error: 'Coupon usage limit reached' });
  if (amount < coupon.min_amount) return res.status(400).json({ error: `Minimum order amount is ₹${coupon.min_amount}` });
  const discount = Math.round(amount * coupon.discount_percent / 100);
  res.json({ valid: true, code: coupon.code, discount_percent: coupon.discount_percent, discount, min_amount: coupon.min_amount });
}));

router.post('/coupons/:id/apply', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const orderId = parsePositiveInt(req.body.order_id);
  const couponCode = asString(req.body.coupon_code, 32);
  if (!orderId || !couponCode) return res.status(400).json({ error: 'Order ID and coupon code required' });
  await run('UPDATE orders SET coupon_code = ? WHERE id = ?', [couponCode, orderId]);
  await run("UPDATE coupons SET used_count = used_count + 1 WHERE code = ?", [couponCode]);
  res.json({ success: true });
}));

router.get('/orders/export', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const orders = await all('SELECT * FROM orders ORDER BY created_at DESC');
  const rows = [['Order ID', 'Date', 'Client Name', 'Client Email', 'Client Phone', 'Address', 'City', 'State', 'Pincode', 'Items', 'Subtotal', 'Shipping', 'Discount', 'Total', 'Status', 'Tracking', 'Coupon']];
  for (const o of orders) {
    rows.push([o.id, o.created_at, o.client_name, o.client_email, o.client_phone || '', o.shipping_address || '', o.shipping_city || '', o.shipping_state || '', o.shipping_pincode || '', o.items_count, o.subtotal, o.shipping, o.discount_amount || 0, o.total, o.status, o.tracking_number || '', o.coupon_code || '']);
  }
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
  res.send('\uFEFF' + csv);
}));

router.get('/orders/:id/invoice', requireAuth, asyncHandler(async (req, res) => {
  const orderId = parsePositiveInt(req.params.id);
  if (!orderId) return res.status(400).json({ error: 'Invalid order id' });
  const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!req.client?.is_admin && order.client_id !== req.client.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const items = await all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  const notes = await all('SELECT * FROM order_notes WHERE order_id = ?', [orderId]);
  res.json({ order, items, notes });
}));

// ===== SETTINGS =====
router.get('/settings', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const rows = await all('SELECT key, value FROM settings');
  const settings = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json({ settings });
}));

router.put('/settings', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'Settings object required' });
  for (const [key, value] of Object.entries(settings)) {
    const existing = await get('SELECT key FROM settings WHERE key = ?', [key]);
    if (existing) {
      await run('UPDATE settings SET value = ? WHERE key = ?', [String(value), key]);
    } else {
      await run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
    }
  }
  res.json({ success: true });
}));

module.exports = router;
