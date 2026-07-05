const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { get, all, run, asyncHandler } = require('../db-helpers');
const { generateToken, requireAuth } = require('../middleware/auth');
const { asString, normalizeEmail, isEmail, isPhone, isPincode } = require('../validation');
const { deliverOtp, shouldShowDemoOtp } = require('../services/otp-sender');

const router = express.Router();
const OTP_TTL_MINUTES = 5;

const otpStore = new Map();
const otpCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of otpStore) {
    if (val.expiresAt < now) otpStore.delete(key);
  }
}, 60000);
if (otpCleanupTimer.unref) otpCleanupTimer.unref();

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function setMissingPricesForClient(client) {
  if (!client || client.is_admin) return;
  const products = await all('SELECT id, category FROM products ORDER BY id');
  const baseByCategory = {
    Necklace: 8500,
    Crowns: 12000,
    Brooch: 4500,
    Earring: 3200,
    Kada: 2800,
    Bracelet: 5500,
    'Necklace Ad Replica': 8500
  };
  const tierMultiplier = {
    wholesale: 0.9,
    distributor: 0.82,
    retailer: 1
  };

  for (const product of products) {
    const existing = await get('SELECT id FROM pricing WHERE client_id = ? AND product_id = ?', [client.id, product.id]);
    if (existing) continue;

    const base = baseByCategory[product.category] || 5000;
    const multiplier = tierMultiplier[client.tier] || 1;
    const variation = (product.id % 11) * 75;
    const price = Math.round((base + variation) * multiplier);
    await run('INSERT INTO pricing (client_id, product_id, price) VALUES (?, ?, ?)', [client.id, product.id, price]);
  }
}

router.post('/send-otp', asyncHandler(async (req, res) => {
  const phone = asString(req.body.phone, 20);
  if (!phone || !isPhone(phone)) {
    return res.status(400).json({ error: 'Valid 10-digit phone number required' });
  }
  const existingClient = await get('SELECT id FROM clients WHERE phone = ?', [phone]);
  const existing = otpStore.get(phone);
  if (existing && existing.expiresAt > Date.now()) {
    const remaining = Math.ceil((existing.expiresAt - Date.now()) / 1000);
    return res.status(429).json({ error: `OTP already sent. Try again in ${remaining}s`, cooldown: remaining });
  }
  const otp = generateOTP();
  let delivery;
  try {
    delivery = await deliverOtp(phone, otp, OTP_TTL_MINUTES);
  } catch (err) {
    console.error('[OTP]', err.message);
    return res.status(503).json({ error: 'OTP delivery is not configured. Please contact admin.' });
  }

  otpStore.set(phone, { otp, expiresAt: Date.now() + OTP_TTL_MINUTES * 60 * 1000 });
  const result = { success: true, message: 'OTP sent to ' + phone, isRegistered: !!existingClient };
  if (shouldShowDemoOtp()) {
    result.otp = otp;
    result.dev = true;
  }
  if (delivery.mode !== 'demo') result.delivery = delivery.mode;
  console.log(`[OTP] ${phone} -> ${shouldShowDemoOtp() ? otp : 'sent'}${shouldShowDemoOtp() ? ' (DEV MODE - shown in response)' : ''}`);
  res.json(result);
}));

router.post('/verify-otp', asyncHandler(async (req, res) => {
  const phone = asString(req.body.phone, 20);
  const otp = asString(req.body.otp, 10);
  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP required' });
  }
  const stored = otpStore.get(phone);
  if (!stored) {
    return res.status(400).json({ error: 'No OTP sent for this number. Please request one.' });
  }
  if (stored.expiresAt < Date.now()) {
    otpStore.delete(phone);
    return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
  }
  if (stored.otp !== otp) {
    return res.status(401).json({ error: 'Invalid OTP' });
  }
  otpStore.delete(phone);

  let client = await get('SELECT * FROM clients WHERE phone = ?', [phone]);
  if (!client) {
    const name = asString(req.body.name, 120) || 'Customer ' + phone.slice(-4);
    const email = phone.replace(/[^0-9]/g, '') + '@customer.Hemlabdhi';
    client = await get('SELECT * FROM clients WHERE email = ?', [email]);
    if (client) {
      await run('UPDATE clients SET phone = ? WHERE id = ?', [phone, client.id]);
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
      console.log(`[OTP] New client created: ${name} (${phone})`);
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
