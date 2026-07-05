/**
 * Barcode → product lookup.        REPLACES api/src/lib/barcode.js
 *
 * Source chain (first hit wins). Every source is failure-safe: if it errors,
 * times out, is unconfigured, or its table/key doesn't exist, we just move on.
 *
 *   0. LOCAL BarcodeReference table  — seeded from the Open Food Facts India
 *      dataset (api/scripts/seedBarcodes.js). Instant, offline, unlimited.
 *      If the table was never migrated/seeded, this source silently skips —
 *      the app works fine without the dataset.
 *   1. Open Food Facts live API (v2) — free
 *   2. UPCitemdb trial               — free ~100/day
 *   3. barcodelookup.com (v3)        — PAID, only used if BARCODELOOKUP_KEY is
 *      set in api/.env. Placed last to conserve your paid quota: it's only
 *      called when every free source missed. Move it earlier in the `sources`
 *      array if you prefer hit-rate over quota.
 *
 * A hit from any EXTERNAL source is written back into BarcodeReference, so
 * the same barcode never costs an external call twice (works for all stores).
 */
const prisma = require('./prisma');

const OFF_V2 = 'https://world.openfoodfacts.org/api/v2/product';
const UPCITEMDB_TRIAL = 'https://api.upcitemdb.com/prod/trial/lookup';
const UPCITEMDB_KEY = process.env.UPCITEMDB_KEY || '';
const BARCODELOOKUP_KEY = process.env.BARCODELOOKUP_KEY || '';
const DEFAULT_TIMEOUT_MS = 8000;

function normalizeBarcode(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).trim().replace(/\s+/g, '').replace(/[-_]/g, '');
}

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') return String(value);
  return value.trim();
}

function normalizePrice(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** EAN-13 prefix → issuing region hint for the UI. */
function issuingRegion(barcode) {
  const n = Number(normalizeBarcode(barcode).slice(0, 3));
  if (n === 890) return 'India';
  if (n >= 891 && n <= 899) return 'India (890–899 range)';
  if (n >= 0 && n <= 139) return 'USA/Canada';
  return null;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(options.headers || {}) },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------------
// Source 0: local seeded dataset. MUST NOT crash if table doesn't exist
// (dataset not seeded / migration not run) — Prisma throws P2021 in that
// case, which we swallow.
// ---------------------------------------------------------------------------
async function lookupLocalReference(barcode) {
  try {
    const row = await prisma.barcodeReference.findUnique({ where: { barcode } });
    if (!row || !row.name) return null;
    return {
      name: row.name,
      description: [row.brand, row.category].filter(Boolean).join(' · ') || null,
      barcode: row.barcode,
      imageUrl: row.imageUrl || null,
      price: null,
      minimumStock: 5,
      category: row.category || null,
      _source: `local:${row.source}`,
    };
  } catch {
    return null; // table missing or DB hiccup — dataset is optional
  }
}

/** Cache an external hit into the local table (best-effort, never throws). */
async function saveToLocalReference(product, sourceName) {
  try {
    await prisma.barcodeReference.upsert({
      where: { barcode: product.barcode },
      create: {
        barcode: product.barcode,
        name: product.name,
        brand: null,
        category: product.category || null,
        imageUrl: product.imageUrl || null,
        source: sourceName,
      },
      update: {},
    });
  } catch {
    /* table missing or race — fine, purely an optimization */
  }
}

// ---------------------------------------------------------------------------
// Source 1: Open Food Facts live
// ---------------------------------------------------------------------------
async function lookupOpenFoodFacts(barcode) {
  const fields =
    'product_name,product_name_en,generic_name,brands,image_url,image_front_url,categories_tags,categories';
  const data = await fetchJson(`${OFF_V2}/${encodeURIComponent(barcode)}.json?fields=${fields}`);
  if (!data || data.status !== 1 || !data.product) return null;
  const p = data.product;
  const name = normalizeText(p.product_name || p.product_name_en || p.generic_name || p.brands || '');
  if (!name) return null;
  return {
    name,
    description: [p.brands, p.generic_name].filter(Boolean).join(' · ') || null,
    barcode,
    imageUrl: p.image_url || p.image_front_url || null,
    price: null,
    minimumStock: 5,
    category: p.categories_tags?.[0]?.replace(/^en:/, '') || p.categories || null,
    _source: 'openfoodfacts',
  };
}

// ---------------------------------------------------------------------------
// Source 2: UPCitemdb (trial, or keyed if UPCITEMDB_KEY set)
// ---------------------------------------------------------------------------
async function lookupUpcItemDb(barcode) {
  const url = UPCITEMDB_KEY
    ? `https://api.upcitemdb.com/prod/v1/lookup?upc=${encodeURIComponent(barcode)}`
    : `${UPCITEMDB_TRIAL}?upc=${encodeURIComponent(barcode)}`;
  const headers = UPCITEMDB_KEY ? { user_key: UPCITEMDB_KEY, key_type: '3scale' } : {};
  const data = await fetchJson(url, { headers });
  const item = data?.items?.[0];
  if (!item) return null;
  const name = normalizeText(item.title || item.brand || '');
  if (!name) return null;
  return {
    name,
    description: [item.brand, item.category].filter(Boolean).join(' · ') || null,
    barcode,
    imageUrl: Array.isArray(item.images) ? item.images[0] : null,
    price: normalizePrice(item.lowest_recorded_price),
    minimumStock: 5,
    category: item.category || null,
    _source: 'upcitemdb',
  };
}

// ---------------------------------------------------------------------------
// Source 3: barcodelookup.com v3 (paid — skipped entirely without a key)
// Docs: GET https://api.barcodelookup.com/v3/products?barcode=X&formatted=y&key=K
// ---------------------------------------------------------------------------
async function lookupBarcodeLookupCom(barcode) {
  if (!BARCODELOOKUP_KEY) return null;
  const url = `https://api.barcodelookup.com/v3/products?barcode=${encodeURIComponent(
    barcode
  )}&formatted=y&key=${encodeURIComponent(BARCODELOOKUP_KEY)}`;
  const data = await fetchJson(url);
  const item = data?.products?.[0];
  if (!item) return null;
  const name = normalizeText(item.title || item.product_name || '');
  if (!name) return null;
  // stores[] sometimes carries retail prices; take the first numeric one
  let price = null;
  if (Array.isArray(item.stores)) {
    for (const s of item.stores) {
      price = normalizePrice(s.price ?? s.sale_price);
      if (price !== null) break;
    }
  }
  return {
    name,
    description: [item.brand, item.manufacturer, item.category].filter(Boolean).join(' · ') || null,
    barcode,
    imageUrl: Array.isArray(item.images) ? item.images[0] : null,
    price,
    minimumStock: 5,
    category: item.category || null,
    _source: 'barcodelookup',
  };
}

// ---------------------------------------------------------------------------
// The chain
// ---------------------------------------------------------------------------
async function lookupProductByBarcode(barcode) {
  const code = normalizeBarcode(barcode);
  if (!code) return null;

  // 0. local dataset — free, instant, optional
  const local = await lookupLocalReference(code);
  if (local) return local;

  // free external sources first, paid last (reorder if you prefer)
  const externals = [
    ['openfoodfacts', lookupOpenFoodFacts],
    ['upcitemdb', lookupUpcItemDb],
    ['barcodelookup', lookupBarcodeLookupCom],
  ];
  for (const [sourceName, source] of externals) {
    try {
      const result = await source(code);
      if (result && result.name) {
        saveToLocalReference(result, sourceName); // fire-and-forget cache
        return result;
      }
    } catch {
      /* one source failing must not kill the chain */
    }
  }
  return null;
}

module.exports = {
  normalizeBarcode,
  normalizeText,
  normalizePrice,
  issuingRegion,
  lookupLocalReference,
  lookupOpenFoodFacts,
  lookupUpcItemDb,
  lookupBarcodeLookupCom,
  lookupProductByBarcode,
};
