const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { get, run } = require('../db-helpers');
const { generateToken, requireAuth } = require('../middleware/auth');
const { asString, normalizeEmail, isEmail, isPhone, isPincode } = require('../validation');
const { deliverOtp, shouldShowDemoOtp } = require('../services/otp-sender');

const router = express.Router();
const OTP_TTL_MINUTES = 5;

// In-memory OTP store: phone -> { otp, expiresAt }
const otpStore = new Map();
// Cleanup expired OTPs every 60s
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

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
  const phone = asString(req.body.phone, 20);
  if (!phone || !isPhone(phone)) {
    return res.status(400).json({ error: 'Valid phone number required' });
  }
  // Prevent OTP spam: check if a valid OTP already exists for this phone
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
  // In development, return OTP in response for convenience
  const result = { success: true, message: 'OTP sent to ' + phone };
  if (shouldShowDemoOtp()) {
    result.otp = otp;
    result.dev = true;
  }
  if (delivery.mode !== 'demo') result.delivery = delivery.mode;
  console.log(`[OTP] ${phone} -> ${shouldShowDemoOtp() ? otp : 'sent'}${shouldShowDemoOtp() ? ' (DEV MODE - shown in response)' : ''}`);
  res.json(result);
});

// POST /api/auth/verify-otp
router.post('/verify-otp', (req, res) => {
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
  otpStore.delete(phone); // OTP used, remove it

  // Find or create client
  let client = get('SELECT * FROM clients WHERE phone = ?', [phone]);
  if (!client) {
    const name = asString(req.body.name, 120) || 'Customer ' + phone.slice(-4);
    const email = phone.replace(/[^0-9]/g, '') + '@customer.Hemlabdhi';
    const tempPass = crypto.randomBytes(16).toString('hex');
    const hashed = bcrypt.hashSync(tempPass, 10);
    const created = run(
      'INSERT INTO clients (name, email, password, tier) VALUES (?, ?, ?, ?)',
      [name, email, hashed, 'retailer']
    );
    client = get('SELECT * FROM clients WHERE id = ?', [created.lastInsertRowid]);
    if (!client) return res.status(500).json({ error: 'Failed to create account' });
    console.log(`[OTP] New client created: ${name} (${phone})`);
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
});

router.post('/login', (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = asString(req.body.password, 128);
  if (!email || !password || !isEmail(email)) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const client = get('SELECT * FROM clients WHERE email = ?', [email]);
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
});

router.get('/me', requireAuth, (req, res) => {
  const client = get('SELECT id, name, email, tier, is_admin, phone, address, city, state, pincode FROM clients WHERE id = ?', [req.client.id]);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json({ client: { ...client, is_admin: !!client.is_admin } });
});

router.put('/profile', requireAuth, (req, res) => {
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

  run('UPDATE clients SET phone = ?, address = ?, city = ?, state = ?, pincode = ? WHERE id = ?',
    [phone, address, city, state, pincode, req.client.id]);
  const client = get('SELECT id, name, email, tier, is_admin, phone, address, city, state, pincode FROM clients WHERE id = ?', [req.client.id]);
  res.json({ success: true, client: { ...client, is_admin: !!client.is_admin } });
});

module.exports = router;
