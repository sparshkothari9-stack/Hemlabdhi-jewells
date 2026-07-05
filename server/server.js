require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { init } = require('./db-helpers');
const { createRateLimiter } = require('./middleware/security');

const isProduction = process.env.NODE_ENV === 'production';

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const adminRoutes = require('./routes/admin');
const orderRoutes = require('./routes/orders');
const featureRoutes = require('./routes/features');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length > 0) {
      return callback(null, allowedOrigins.includes(origin));
    }
    return callback(null, /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  }
}));
app.use(express.json({ limit: '50kb' }));

app.use(express.static(path.join(__dirname, '..'), {
  maxAge: isProduction ? '1y' : 0,
  etag: true,
  lastModified: true,
  setHeaders(res, path) {
    if (path.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache');
    }
  }
}));

const apiLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 300 });
const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many login attempts. Please try again later.' });
const writeLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 80 });

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/admin', writeLimiter);
app.use('/api/orders', writeLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api', featureRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: isProduction ? 'production' : 'development' });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message, err.stack);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

if (require.main === module) {
  init().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} [${isProduction ? 'production' : 'development'}]`);
    });
  }).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { app, initApp: init };
