const express = require('express');
const { get, all, asyncHandler } = require('../db-helpers');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const clientId = req.client.id;

  const pricing = await all('SELECT product_id, price FROM pricing WHERE client_id = ?', [clientId]);
  const priceMap = {};
  for (const p of pricing) {
    priceMap[p.product_id] = p.price;
  }

  const products = await all('SELECT id, name, description, features, sku, category, images, badge FROM products ORDER BY id');
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

module.exports = router;
