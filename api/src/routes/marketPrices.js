// ============================================================================
// NEW FILE: api/src/routes/marketPrices.js
//
// Server-side proxy to your price-scraper service. Your React app calls THIS,
// never the scraper directly — so the scraper's X-API-Key stays secret.
//
// Add to api/src/app.js (with the other route mounts):
//     const marketPriceRoutes = require('./routes/marketPrices');
//     app.use('/api/stores', marketPriceRoutes);
//
// Add to api/.env:
//     SCRAPER_URL=http://localhost:8000
//     SCRAPER_KEY=the-same-value-as-API_KEYS-in-the-scraper-.env
//     STORE_PINCODE=413001
// ============================================================================
const router = require('express').Router();
const { z } = require('zod');
const { asyncHandler, ApiError } = require('../lib/utils');
const { validate } = require('../middleware/error');
const { authenticate } = require('../middleware/auth');
const { requireStoreAccess } = require('../middleware/storeAccess');

const SCRAPER_URL = process.env.SCRAPER_URL || 'http://localhost:8000';
const SCRAPER_KEY = process.env.SCRAPER_KEY || '';
const STORE_PINCODE = process.env.STORE_PINCODE || '413001';

async function scraperFetch(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 95000);
  try {
    const res = await fetch(`${SCRAPER_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'X-API-Key': SCRAPER_KEY, 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new ApiError(res.status === 401 ? 500 : 502, `Price service error: ${body.slice(0, 200)}`);
    }
    return await res.json();
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e.name === 'AbortError') throw new ApiError(504, 'Price service timed out');
    throw new ApiError(502, 'Price service unreachable. Is the scraper running?');
  } finally {
    clearTimeout(timeout);
  }
}

// GET /:storeId/market-prices?query=amul butter   -> cached, instant
router.get(
  '/:storeId/market-prices',
  authenticate,
  requireStoreAccess,
  validate({ query: z.object({ query: z.string().min(1), platforms: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const params = new URLSearchParams({
      query: req.query.query,
      pincode: STORE_PINCODE,
      platforms: req.query.platforms || 'blinkit,zepto,instamart',
    });
    const data = await scraperFetch(`/prices?${params.toString()}`);
    res.json(data);
  })
);

// POST /:storeId/market-prices/refresh?query=...  -> live scrape (30-90s)
router.post(
  '/:storeId/market-prices/refresh',
  authenticate,
  requireStoreAccess,
  validate({ query: z.object({ query: z.string().min(1), platforms: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const params = new URLSearchParams({
      query: req.query.query,
      pincode: STORE_PINCODE,
      platforms: req.query.platforms || 'blinkit,zepto,instamart',
    });
    const data = await scraperFetch(`/refresh?${params.toString()}`, { method: 'POST' });
    res.json(data);
  })
);

module.exports = router;
