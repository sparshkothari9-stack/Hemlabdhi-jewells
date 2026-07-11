const express = require('express');
const { get, all, run, asyncHandler } = require('../db-helpers');
const { asString, sanitize } = require('../validation');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const rows = await all('SELECT product_id, name, text, rating, date FROM reviews ORDER BY created_at DESC');
  const grouped = {};
  for (const r of rows) {
    if (!grouped[r.product_id]) grouped[r.product_id] = [];
    grouped[r.product_id].push({ name: r.name, text: r.text, rating: r.rating, date: r.date });
  }
  res.json({ reviews: grouped });
}));

router.get('/:productId', asyncHandler(async (req, res) => {
  const productId = parseInt(req.params.productId, 10);
  if (!productId) return res.status(400).json({ error: 'Invalid product ID' });
  const reviews = await all('SELECT name, text, rating, date FROM reviews WHERE product_id = ? ORDER BY created_at DESC', [productId]);
  res.json({ reviews });
}));

router.post('/:productId', asyncHandler(async (req, res) => {
  const productId = parseInt(req.params.productId, 10);
  if (!productId) return res.status(400).json({ error: 'Invalid product ID' });
  const name = asString(req.body.name, 50) || 'Anonymous';
  const text = asString(req.body.text, 500);
  const rating = Math.min(5, Math.max(1, parseInt(req.body.rating, 10) || 5));
  if (!text) return res.status(400).json({ error: 'Review text is required' });
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  await run('INSERT INTO reviews (product_id, name, text, rating, date) VALUES (?, ?, ?, ?, ?)',
    [productId, sanitize(name), sanitize(text), rating, date]);
  res.json({ success: true });
}));

module.exports = router;
