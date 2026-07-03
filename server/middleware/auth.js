const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { get } = require('../db-helpers');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set to at least 32 characters in production.');
  }

  if (!getJwtSecret.devSecret) {
    getJwtSecret.devSecret = crypto.randomBytes(48).toString('hex');
    console.warn('JWT_SECRET is not set. Using a temporary development secret; logins expire when the server restarts.');
  }
  return getJwtSecret.devSecret;
}

function generateToken(client) {
  return jwt.sign(
    { id: client.id },
    getJwtSecret(),
    { expiresIn: '30d' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const payload = verifyToken(header.slice(7));
    const client = get('SELECT id, name, email, tier, is_admin FROM clients WHERE id = ?', [payload.id]);
    if (!client) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.client = { ...client, is_admin: !!client.is_admin };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.client || !req.client.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { generateToken, verifyToken, requireAuth, requireAdmin };
