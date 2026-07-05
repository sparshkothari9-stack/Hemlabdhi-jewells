const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { get, all, run, asyncHandler } = require('../db-helpers');
const { generateToken, requireAuth } = require('../middleware/auth');
const { asString, normalizeEmail, isEmail, isPhone, isPincode } = require('../validation');
const { deliverOtp, shouldShowDemoOtp } = require('../services/otp-sender');

const router = express.Router();
const OTP_TTL_MINUTES = 5;

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getChallengeKey() {
  const secret = process.env.JWT_SECRET || 'development-otp-challenge-secret';
  return crypto.createHash('sha256').update(secret).digest();
}

function base64Url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function encryptOtpChallenge(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getChallengeKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return [base64Url(iv), base64Url(tag), base64Url(encrypted)].join('.');
}

function decryptOtpChallenge(challenge) {
  const parts = asString(challenge, 2000).split('.');
  if (parts.length !== 3) return null;
  try {
    const [iv, tag, encrypted] = parts.map(part => Buffer.from(part, 'base64url'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', getChallengeKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

function sameOtp(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function setMissingPricesForClient(client) {
  if (!client || client.is_admin) return;
  const tierMultiplier = {
    wholesale: 0.9,
    distributor: 0.82,
    retailer: 1
  };
  const multiplier = tierMultiplier[client.tier] || 1;
  await run(
    `INSERT INTO pricing (client_id, product_id, price)
     SELECT ?, p.id,
       ROUND((
         CASE p.category
           WHEN 'Necklace' THEN 8500
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

router.post('/send-otp', asyncHandler(async (req, res) => {
  const phone = asString(req.body.phone, 20);
  if (!phone || !isPhone(phone)) {
    return res.status(400).json({ error: 'Valid 10-digit phone number required' });
  }
  const derivedEmail = phone.replace(/[^0-9]/g, '') + '@customer.Hemlabdhi';
  const existingClient = await get('SELECT id FROM clients WHERE phone = ? OR email = ?', [phone, derivedEmail]);
  const otp = generateOTP();
  let delivery;
  try {
    delivery = await deliverOtp(phone, otp, OTP_TTL_MINUTES);
  } catch (err) {
    console.error('[OTP]', err.message);
    return res.status(503).json({ error: 'OTP delivery is not configured. Please contact admin.' });
  }

  const result = {
    success: true,
    message: 'OTP sent to ' + phone,
    isRegistered: !!existingClient,
    challenge: encryptOtpChallenge({
      phone,
      otp,
      exp: Date.now() + OTP_TTL_MINUTES * 60 * 1000
    }),
    expires_in_minutes: OTP_TTL_MINUTES
  };
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
  const challenge = decryptOtpChallenge(req.body.challenge);
  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP required' });
  }
  if (!challenge || challenge.phone !== phone) {
    return res.status(400).json({ error: 'No OTP sent for this number. Please request one.' });
  }
  if (!challenge.exp || challenge.exp < Date.now()) {
    return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
  }
  if (!sameOtp(challenge.otp, otp)) {
    return res.status(401).json({ error: 'Invalid OTP' });
  }

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
