const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { errorHandler } = require('./middleware/error');
const authRoutes = require('./routes/auth');
const storeRoutes = require('./routes/stores');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const publicRoutes = require('./routes/public');
const meRoutes = require('./routes/me');
const catalogRoutes = require('./routes/catalog');

const app = express();

const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isLocalDevOrigin = (origin) => {
  if (process.env.NODE_ENV === 'production') return false;
  try {
    const { hostname, protocol } = new URL(origin);
    return (
      (protocol === 'http:' || protocol === 'https:') &&
      ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)
    );
  } catch {
    return false;
  }
};

const corsOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (configuredOrigins.includes('*')) return callback(null, true);
  if (configuredOrigins.includes(origin) || isLocalDevOrigin(origin)) {
    return callback(null, true);
  }
  return callback(null, false);
};

// In production we also serve the built SPA, which uses inline scripts
// (Razorpay checkout via window.Razorpay) and remote font CSS. Relax helmet's
// default CSP just enough to allow those without exposing a CSP-less site.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", 'https://checkout.razorpay.com'],
        'connect-src': ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
        'frame-src': ['https://api.razorpay.com'],
        'img-src': ["'self'", 'data:', 'https:'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(
  '/api/auth',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 50 }),
  authRoutes
);

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api/stores', storeRoutes);
app.use('/api/stores', productRoutes); // shares /:storeId namespace
app.use('/api/stores', orderRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/me', meRoutes);
app.use('/api/catalog', catalogRoutes); // centralized master catalog + /catalog/stores/:storeId/from-catalog

// In production, serve the built SPA. /api/* routes already handled above;
// everything else falls through to the SPA's index.html so client-side routes
// like /store/:slug work on direct loads.
const spaDir = path.resolve(__dirname, '..', 'public');
if (fs.existsSync(path.join(spaDir, 'index.html'))) {
  app.use(express.static(spaDir, { index: false, maxAge: '1y', immutable: true }));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(spaDir, 'index.html'));
  });
}

app.use(errorHandler);

module.exports = app;
