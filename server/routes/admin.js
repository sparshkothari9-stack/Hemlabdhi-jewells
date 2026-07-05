const express = require('express');
const bcrypt = require('bcryptjs');
const { get, all, run, asyncHandler } = require('../db-helpers');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asString, normalizeEmail, isEmail, parsePositiveInt, parseMoney, normalizeTier } = require('../validation');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/clients', asyncHandler(async (req, res) => {
  const clients = await all('SELECT id, name, email, tier, is_admin, created_at FROM clients ORDER BY id');
  res.json({ clients: clients.map(c => ({ ...c, is_admin: !!c.is_admin })) });
}));

router.post('/clients', asyncHandler(async (req, res) => {
  const name = asString(req.body.name, 120);
  const email = normalizeEmail(req.body.email);
  const password = asString(req.body.password, 128);
  const tier = normalizeTier(req.body.tier);

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password required' });
  }
  if (!isEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!tier) {
    return res.status(400).json({ error: 'Invalid client tier' });
  }

  const existing = await get('SELECT id FROM clients WHERE email = ?', [email]);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const hash = bcrypt.hashSync(password, 10);
  await run('INSERT INTO clients (name, email, password, tier) VALUES (?, ?, ?, ?)', [name, email, hash, tier]);
  const client = await get('SELECT id, name, email, tier, is_admin, created_at FROM clients WHERE id = last_insert_rowid()');
  res.status(201).json({ client: { ...client, is_admin: !!client.is_admin } });
}));

router.put('/clients/:id', asyncHandler(async (req, res) => {
  const clientId = parsePositiveInt(req.params.id);
  if (!clientId) return res.status(400).json({ error: 'Invalid client id' });

  const name = asString(req.body.name, 120);
  const tier = req.body.tier ? normalizeTier(req.body.tier) : null;
  const existing = await get('SELECT id FROM clients WHERE id = ?', [clientId]);
  if (!existing) return res.status(404).json({ error: 'Client not found' });
  if (req.body.tier && !tier) return res.status(400).json({ error: 'Invalid client tier' });
  if (name) await run('UPDATE clients SET name = ? WHERE id = ?', [name, clientId]);
  if (tier) await run('UPDATE clients SET tier = ? WHERE id = ?', [tier, clientId]);
  const client = await get('SELECT id, name, email, tier, is_admin, created_at FROM clients WHERE id = ?', [clientId]);
  res.json({ client: { ...client, is_admin: !!client.is_admin } });
}));

router.delete('/clients/:id', asyncHandler(async (req, res) => {
  const clientId = parsePositiveInt(req.params.id);
  if (!clientId) return res.status(400).json({ error: 'Invalid client id' });
  const existing = await get('SELECT id FROM clients WHERE id = ? AND is_admin = 0', [clientId]);
  if (!existing) return res.status(404).json({ error: 'Client not found or cannot delete admin' });
  await run('DELETE FROM clients WHERE id = ?', [clientId]);
  res.json({ success: true });
}));

router.get('/pricing/:clientId', asyncHandler(async (req, res) => {
  const clientId = parsePositiveInt(req.params.clientId);
  if (!clientId) return res.status(400).json({ error: 'Invalid client id' });
  const pricing = await all('SELECT product_id, price FROM pricing WHERE client_id = ?', [clientId]);
  const priceMap = {};
  for (const p of pricing) priceMap[p.product_id] = p.price;
  res.json({ pricing: priceMap });
}));

router.post('/pricing/:clientId', asyncHandler(async (req, res) => {
  const clientId = parsePositiveInt(req.params.clientId);
  if (!clientId) return res.status(400).json({ error: 'Invalid client id' });
  const client = await get('SELECT id FROM clients WHERE id = ? AND is_admin = 0', [clientId]);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const { pricing } = req.body;
  if (!pricing || typeof pricing !== 'object') {
    return res.status(400).json({ error: 'Pricing object required { product_id: price }' });
  }

  const rows = [];
  for (const [productId, price] of Object.entries(pricing)) {
    const parsedProductId = parsePositiveInt(productId);
    const parsedPrice = parseMoney(price);
    if (!parsedProductId || parsedPrice === null) {
      return res.status(400).json({ error: 'Invalid product id or price' });
    }
    const product = await get('SELECT id FROM products WHERE id = ?', [parsedProductId]);
    if (!product) {
      return res.status(400).json({ error: `Product ${parsedProductId} does not exist` });
    }
    rows.push({ productId: parsedProductId, price: parsedPrice });
  }

  await run('DELETE FROM pricing WHERE client_id = ?', [clientId]);
  for (const row of rows) {
    await run('INSERT INTO pricing (client_id, product_id, price) VALUES (?, ?, ?)', [clientId, row.productId, row.price]);
  }

  const updated = await all('SELECT product_id, price FROM pricing WHERE client_id = ?', [clientId]);
  const priceMap = {};
  for (const p of updated) priceMap[p.product_id] = p.price;
  res.json({ pricing: priceMap });
}));

module.exports = router;
