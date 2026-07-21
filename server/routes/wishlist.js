const express = require('express');
const { get, all, run, asyncHandler } = require('../db-helpers');
const { requireAuth } = require('../middleware/auth');
const { parsePositiveInt } = require('../validation');

const router = express.Router();

router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const items = await all(
    `SELECT w.product_id as id, p.name, p.images
     FROM wishlist_items w JOIN products p ON w.product_id = p.id
     WHERE w.client_id = ? ORDER BY w.created_at DESC`,
    [req.client.id]
  );
  res.json({ wishlist: items.map(i => ({ ...i, images: safeParseJson(i.images, []) })) });
}));

router.post('/toggle', asyncHandler(async (req, res) => {
  const productId = parsePositiveInt(req.body.product_id);
  if (!productId) return res.status(400).json({ error: 'Invalid product' });
  const existing = await get('SELECT id FROM wishlist_items WHERE client_id = ? AND product_id = ?', [req.client.id, productId]);
  if (existing) {
    await run('DELETE FROM wishlist_items WHERE client_id = ? AND product_id = ?', [req.client.id, productId]);
    res.json({ success: true, in_wishlist: false });
  } else {
    await run('INSERT INTO wishlist_items (client_id, product_id) VALUES (?, ?)', [req.client.id, productId]);
    res.json({ success: true, in_wishlist: true });
  }
}));

function safeParseJson(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

module.exports = router;
