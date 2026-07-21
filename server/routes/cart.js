const express = require('express');
const { get, all, run, asyncHandler } = require('../db-helpers');
const { requireAuth } = require('../middleware/auth');
const { parsePositiveInt } = require('../validation');

const router = express.Router();

router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const items = await all(
    `SELECT c.product_id as id, c.qty, p.name, p.images
     FROM cart_items c JOIN products p ON c.product_id = p.id
     WHERE c.client_id = ? ORDER BY c.created_at`,
    [req.client.id]
  );
  res.json({ cart: items.map(i => ({ ...i, images: safeParseJson(i.images, []) })) });
}));

router.post('/add', asyncHandler(async (req, res) => {
  const productId = parsePositiveInt(req.body.product_id);
  const qty = Math.max(1, parseInt(req.body.qty, 10) || 1);
  if (!productId) return res.status(400).json({ error: 'Invalid product' });
  const existing = await get('SELECT id, qty FROM cart_items WHERE client_id = ? AND product_id = ?', [req.client.id, productId]);
  if (existing) {
    await run('UPDATE cart_items SET qty = qty + ? WHERE id = ?', [qty, existing.id]);
  } else {
    await run('INSERT INTO cart_items (client_id, product_id, qty) VALUES (?, ?, ?)', [req.client.id, productId, qty]);
  }
  const count = await get('SELECT COALESCE(SUM(qty),0) as count FROM cart_items WHERE client_id = ?', [req.client.id]);
  res.json({ success: true, cart_count: count.count });
}));

router.post('/update-qty', asyncHandler(async (req, res) => {
  const productId = parsePositiveInt(req.body.product_id);
  const qty = parseInt(req.body.qty, 10);
  if (!productId) return res.status(400).json({ error: 'Invalid product' });
  if (qty < 1) {
    await run('DELETE FROM cart_items WHERE client_id = ? AND product_id = ?', [req.client.id, productId]);
  } else {
    const existing = await get('SELECT id FROM cart_items WHERE client_id = ? AND product_id = ?', [req.client.id, productId]);
    if (existing) {
      await run('UPDATE cart_items SET qty = ? WHERE client_id = ? AND product_id = ?', [qty, req.client.id, productId]);
    }
  }
  const count = await get('SELECT COALESCE(SUM(qty),0) as count FROM cart_items WHERE client_id = ?', [req.client.id]);
  res.json({ success: true, cart_count: count.count });
}));

router.post('/remove', asyncHandler(async (req, res) => {
  const productId = parsePositiveInt(req.body.product_id);
  if (!productId) return res.status(400).json({ error: 'Invalid product' });
  await run('DELETE FROM cart_items WHERE client_id = ? AND product_id = ?', [req.client.id, productId]);
  const count = await get('SELECT COALESCE(SUM(qty),0) as count FROM cart_items WHERE client_id = ?', [req.client.id]);
  res.json({ success: true, cart_count: count.count });
}));

router.get('/count', asyncHandler(async (req, res) => {
  const result = await get('SELECT COALESCE(SUM(qty),0) as count FROM cart_items WHERE client_id = ?', [req.client.id]);
  res.json({ count: result.count });
}));

function safeParseJson(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

module.exports = router;
