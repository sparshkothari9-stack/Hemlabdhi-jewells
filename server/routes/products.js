const express = require('express');
const { get, all, run, asyncHandler } = require('../db-helpers');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const products = await all('SELECT id, name, description, features, sku, category, images, badge FROM products ORDER BY id');
  const prices = await all('SELECT product_id, price FROM pricing WHERE client_id = ?', [req.client.id]);
  const priceMap = {};
  for (const p of prices) priceMap[p.product_id] = p.price;

  const result = products.map(p => {
    let images, features;
    try { images = JSON.parse(p.images); } catch { images = [p.images]; }
    try { features = JSON.parse(p.features); } catch { features = []; }
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      features,
      sku: p.sku,
      category: p.category,
      images,
      badge: p.badge,
      price: priceMap[p.id] || null
    };
  });

  res.json({ products: result });
}));

router.get('/categories', requireAuth, asyncHandler(async (req, res) => {
  const categories = await all('SELECT DISTINCT category FROM products ORDER BY category');
  const catData = [];
  for (const c of categories) {
    const cnt = await get('SELECT COUNT(*) as cnt FROM products WHERE category = ?', [c.category]);
    catData.push({ name: c.category, count: `${cnt.cnt} Designs` });
  }
  res.json({ categories: catData });
}));

router.post('/recent', requireAuth, asyncHandler(async (req, res) => {
  const productId = parseInt(req.body.product_id, 10);
  if (!productId) return res.status(400).json({ error: 'Invalid product' });
  await run('DELETE FROM recent_products WHERE client_id = ?', [req.client.id]);
  await run('INSERT INTO recent_products (client_id, product_id) VALUES (?, ?)', [req.client.id, productId]);
  const allRecent = await all('SELECT product_id FROM recent_products WHERE client_id = ? ORDER BY viewed_at DESC LIMIT 8', [req.client.id]);
  res.json({ success: true });
}));

router.get('/recent', requireAuth, asyncHandler(async (req, res) => {
  const items = await all('SELECT product_id FROM recent_products WHERE client_id = ? ORDER BY viewed_at DESC LIMIT 8', [req.client.id]);
  res.json({ recent: items.map(i => i.product_id) });
}));

module.exports = router;
