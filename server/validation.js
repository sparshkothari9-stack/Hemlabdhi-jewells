const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\d\s-]{10,22}$/;
const PINCODE_RE = /^\d{6}$/;
const VALID_TIERS = new Set(['retailer', 'wholesale', 'distributor']);

function asString(value, max = 255) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function normalizeEmail(value) {
  return asString(value, 254).toLowerCase();
}

function isEmail(value) {
  return EMAIL_RE.test(value);
}

function isPhone(value) {
  if (!PHONE_RE.test(value)) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function isPincode(value) {
  return PINCODE_RE.test(value);
}

function parsePositiveInt(value, max = Number.MAX_SAFE_INTEGER) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0 || num > max) return null;
  return num;
}

function parseMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 10000000) return null;
  return Math.round(num * 100) / 100;
}

function normalizeTier(value) {
  const tier = asString(value || 'retailer', 32).toLowerCase();
  return VALID_TIERS.has(tier) ? tier : null;
}

module.exports = {
  asString,
  normalizeEmail,
  isEmail,
  isPhone,
  isPincode,
  parsePositiveInt,
  parseMoney,
  normalizeTier
};
