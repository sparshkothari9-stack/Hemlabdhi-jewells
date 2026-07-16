const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { get, all, run, asyncHandler } = require('../db-helpers');
const { generateToken, requireAuth } = require('../middleware/auth');
const { asString, normalizeEmail, isEmail, isPhone, isPincode } = require('../validation');

const router = express.Router();

async function setMissingPricesForClient(client) {
  if (!client || client.is_admin) return;
  const tierMultiplier = {
    wholesale: 0.9,
    distributor: 0.82,
    retailer: 1
  };
  const multiplier = tierMultiplier[client.tier] || 1;
  await run(
    `INSERT OR IGNORE INTO pricing (client_id, product_id, price)
     SELECT ?, p.id,
       ROUND((
          CASE p.category
            WHEN 'Crowns' THEN 12000
           WHEN 'Brooch' THEN 4500
           WHEN 'Earring' THEN 3200
           WHEN 'Kada' THEN 2800
           WHEN 'Bracelet' THEN 5500
           WHEN 'Necklace Ad Replica' THEN 8500
           ELSE 5000
         END + ((p.id % 11) * 75)
       ) * ?)
     FROM products p
     WHERE NOT EXISTS (
       SELECT 1 FROM pricing existing
       WHERE existing.client_id = ? AND existing.product_id = p.id
     )`,
    [client.id, multiplier, client.id]
  );
}

router.post('/quick-login', asyncHandler(async (req, res) => {
  const phone = asString(req.body.phone, 20);
  const name = asString(req.body.name, 120);
  if (!phone || !isPhone(phone)) {
    return res.status(400).json({ error: 'Valid 10-digit phone number required' });
  }
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  let client = await get('SELECT * FROM clients WHERE phone = ?', [phone]);
  if (!client) {
    const email = phone.replace(/[^0-9]/g, '') + '@customer.HemLabdhiJewels';
    client = await get('SELECT * FROM clients WHERE email = ?', [email]);
    if (client) {
      await run('UPDATE clients SET phone = ?, name = ? WHERE id = ?', [phone, name, client.id]);
      client = await get('SELECT * FROM clients WHERE id = ?', [client.id]);
    } else {
      const tempPass = crypto.randomBytes(16).toString('hex');
      const hashed = bcrypt.hashSync(tempPass, 10);
      const created = await run(
        'INSERT INTO clients (name, email, password, tier, phone) VALUES (?, ?, ?, ?, ?)',
        [name, email, hashed, 'retailer', phone]
      );
      client = await get('SELECT * FROM clients WHERE id = ?', [created.lastInsertRowid]);
      if (!client) return res.status(500).json({ error: 'Failed to create account' });
      console.log(`[QuickLogin] New client created: ${name} (${phone})`);
    }
  } else {
    if (name !== client.name) {
      await run('UPDATE clients SET name = ? WHERE id = ?', [name, client.id]);
      client = await get('SELECT * FROM clients WHERE id = ?', [client.id]);
    }
  }
  await setMissingPricesForClient(client);
  const token = generateToken(client);
  res.json({
    token,
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      tier: client.tier,
      is_admin: !!client.is_admin
    }
  });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = asString(req.body.password, 128);
  if (!email || !password || !isEmail(email)) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const client = await get('SELECT * FROM clients WHERE email = ?', [email]);
  if (!client) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (!bcrypt.compareSync(password, client.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = generateToken(client);
  res.json({
    token,
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      tier: client.tier,
      is_admin: !!client.is_admin
    }
  });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const client = await get('SELECT id, name, email, tier, is_admin, phone, address, city, state, pincode FROM clients WHERE id = ?', [req.client.id]);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json({ client: { ...client, is_admin: !!client.is_admin } });
}));

router.put('/profile', requireAuth, asyncHandler(async (req, res) => {
  const phone = asString(req.body.phone, 20);
  const address = asString(req.body.address, 500);
  const city = asString(req.body.city, 80);
  const state = asString(req.body.state, 80);
  const pincode = asString(req.body.pincode, 12);

  if (phone && !isPhone(phone)) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }
  if (pincode && !isPincode(pincode)) {
    return res.status(400).json({ error: 'Invalid pincode' });
  }

  await run('UPDATE clients SET phone = ?, address = ?, city = ?, state = ?, pincode = ? WHERE id = ?',
    [phone, address, city, state, pincode, req.client.id]);
  const client = await get('SELECT id, name, email, tier, is_admin, phone, address, city, state, pincode FROM clients WHERE id = ?', [req.client.id]);
  res.json({ success: true, client: { ...client, is_admin: !!client.is_admin } });
}));

module.exports = router;
