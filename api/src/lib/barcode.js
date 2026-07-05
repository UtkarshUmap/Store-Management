const OPENFOODFACTS_BASE = 'https://world.openfoodfacts.org/api/v0/product';
const SEARCHUPC_API_KEY = 'upc_o71s1dmj5ymr3u10jd';
const DEFAULT_TIMEOUT_MS = 8000;

function normalizeBarcode(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, '').replace(/[-_]/g, '');
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

function extractPrice(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const candidates = [
    payload.price,
    payload.price_value,
    payload.price_eur,
    payload.price_usd,
    payload.price_gbp,
    payload.price_inr,
    payload.price_amount,
    payload.current_price,
    payload.sale_price,
    payload.amount,
    payload.unit_price,
  ];

  for (const candidate of candidates) {
    const parsed = normalizePrice(candidate);
    if (parsed !== null) return parsed;
  }

  return null;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function lookupOpenFoodFacts(barcode) {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) return null;

  try {
    const response = await fetchWithTimeout(`${OPENFOODFACTS_BASE}/${encodeURIComponent(normalized)}.json`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.status !== 1 || !data.product) return null;

    const product = data.product;
    return {
      name: normalizeText(product.product_name || product.generic_name || product.brands || product.product_name_en || ''),
      description: [product.brands, product.generic_name, product.categories].filter(Boolean).join(' · ') || null,
      barcode: normalized,
      imageUrl:
        product.image_url || product.image_front_url || product.image_small_url || product.image_thumb_url || null,
      price: extractPrice(product),
      minimumStock: 5,
      category: product.categories_tags?.[0]?.replace(/^en:/, '') || product.categories || null,
    };
  } catch {
    return null;
  }
}

async function lookupSearchUPC(barcode) {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) return null;

  const urls = [
    `https://api.searchupc.com/v1/lookup?upc=${encodeURIComponent(normalized)}&apikey=${SEARCHUPC_API_KEY}`,
    `https://api.searchupc.com/lookup?upc=${encodeURIComponent(normalized)}&apikey=${SEARCHUPC_API_KEY}`,
  ];

  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) continue;
      const data = await response.json();
      const item = Array.isArray(data.items) ? data.items[0] : data;
      if (!item) continue;

      return {
        name: normalizeText(item.title || item.name || item.product_name || ''),
        description: [item.brand, item.manufacturer, item.category, item.description].filter(Boolean).join(' · ') || null,
        barcode: normalized,
        imageUrl: item.image || item.images?.[0] || item.image_url || null,
        price: extractPrice(item),
        minimumStock: 5,
        category: item.category || item.sub_category || null,
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function lookupProductByBarcode(barcode) {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) return null;

  const [openFoodResult, searchUPCResult] = await Promise.allSettled([
    lookupOpenFoodFacts(normalized),
    lookupSearchUPC(normalized),
  ]);

  const openFood = openFoodResult.status === 'fulfilled' ? openFoodResult.value : null;
  if (openFood) return openFood;

  const searchUPC = searchUPCResult.status === 'fulfilled' ? searchUPCResult.value : null;
  if (searchUPC) return searchUPC;

  return null;
}

module.exports = {
  normalizeBarcode,
  normalizeText,
  normalizePrice,
  extractPrice,
  lookupOpenFoodFacts,
  lookupSearchUPC,
  lookupProductByBarcode,
};
