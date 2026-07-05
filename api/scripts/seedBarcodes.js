/**
 * NEW FILE: api/scripts/seedBarcodes.js
 *
 * Seeds the BarcodeReference table with Indian products from Open Food Facts.
 *
 * TWO MODES:
 *
 *   1) API mode (default, no download needed):
 *        node scripts/seedBarcodes.js
 *      Pages through the OFF search API filtered to India (~30-40k products,
 *      ~300-400 polite requests, takes ~10-20 min). Resume-safe: re-running
 *      just upserts.
 *
 *   2) CSV mode (if you downloaded an OFF CSV export yourself):
 *        node scripts/seedBarcodes.js path/to/products.csv
 *      Expects the official OFF CSV format (tab-separated). Only rows whose
 *      countries_tags contains "india" are imported. The full world CSV is
 *      ~10 GB — API mode is easier unless you already have the file.
 *
 * The dataset file itself does NOT live in your repo — the data goes into
 * Postgres. If you use CSV mode, keep the CSV anywhere (e.g. Downloads) and
 * pass its path; you can delete it after seeding.
 *
 * Prerequisite:  npx prisma migrate dev --name add_barcode_reference
 *
 * The app is fully functional WITHOUT running this — the lookup chain just
 * skips the local table if it's empty or missing.
 */
const fs = require('fs');
const readline = require('readline');
const prisma = require('../src/lib/prisma');

const OFF_SEARCH = 'https://world.openfoodfacts.org/api/v2/search';
const PAGE_SIZE = 100;                 // OFF v2 search max
const DELAY_MS = 1500;                 // be polite — OFF is a nonprofit
const FIELDS = 'code,product_name,product_name_en,brands,image_url,categories_tags';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cleanRow(code, name, brand, category, imageUrl) {
  const barcode = String(code || '').trim();
  const n = String(name || '').trim();
  if (!/^\d{8,14}$/.test(barcode) || !n) return null;
  return {
    barcode,
    name: n.slice(0, 300),
    brand: (brand || '').trim().slice(0, 200) || null,
    category: (category || '').trim().slice(0, 200) || null,
    imageUrl: (imageUrl || '').trim().slice(0, 500) || null,
    source: 'openfoodfacts',
  };
}

async function upsertBatch(rows) {
  let saved = 0;
  for (const row of rows) {
    try {
      await prisma.barcodeReference.upsert({
        where: { barcode: row.barcode },
        create: row,
        update: { name: row.name, brand: row.brand, category: row.category, imageUrl: row.imageUrl },
      });
      saved++;
    } catch (e) {
      if (e.code === 'P2021') {
        console.error('\nTable BarcodeReference does not exist.');
        console.error('Run first:  npx prisma migrate dev --name add_barcode_reference\n');
        process.exit(1);
      }
      // skip bad row, keep going
    }
  }
  return saved;
}

// ---------------------------------------------------------------------------
// Mode 1: page the OFF API for India
// ---------------------------------------------------------------------------
async function seedFromApi() {
  let page = 1;
  let total = 0;
  console.log('Seeding from Open Food Facts API (countries: India)...');
  for (;;) {
    const url =
      `${OFF_SEARCH}?countries_tags=en:india&fields=${FIELDS}` +
      `&page_size=${PAGE_SIZE}&page=${page}&sort_by=unique_scans_n`;
    let data;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'StoreApp-Seeder/1.0 (kirana store inventory)' } });
      if (!res.ok) {
        console.log(`page ${page}: HTTP ${res.status}, retrying in 10s...`);
        await sleep(10000);
        continue;
      }
      data = await res.json();
    } catch (e) {
      console.log(`page ${page}: ${e.message}, retrying in 10s...`);
      await sleep(10000);
      continue;
    }

    const products = data.products || [];
    if (products.length === 0) break;

    const rows = products
      .map((p) =>
        cleanRow(
          p.code,
          p.product_name || p.product_name_en || p.brands,
          p.brands,
          p.categories_tags?.[0]?.replace(/^en:/, ''),
          p.image_url
        )
      )
      .filter(Boolean);

    total += await upsertBatch(rows);
    const pageCount = Math.ceil((data.count || 0) / PAGE_SIZE);
    process.stdout.write(`\rpage ${page}/${pageCount || '?'} — ${total} products saved`);
    if (pageCount && page >= pageCount) break;
    page++;
    await sleep(DELAY_MS);
  }
  console.log(`\nDone. ${total} Indian products in BarcodeReference.`);
}

// ---------------------------------------------------------------------------
// Mode 2: import from a downloaded OFF CSV (tab-separated) — streams the
// file line by line, so even the 10 GB world dump won't blow up memory.
// ---------------------------------------------------------------------------
async function seedFromCsv(path) {
  if (!fs.existsSync(path)) {
    console.error(`File not found: ${path}`);
    process.exit(1);
  }
  console.log(`Seeding from CSV: ${path} (only rows tagged India)...`);
  const rl = readline.createInterface({ input: fs.createReadStream(path), crlfDelay: Infinity });

  let header = null;
  let idx = {};
  let total = 0;
  let batch = [];

  for await (const line of rl) {
    const cols = line.split('\t');
    if (!header) {
      header = cols;
      for (const key of ['code', 'product_name', 'brands', 'categories_tags', 'countries_tags', 'image_url']) {
        idx[key] = header.indexOf(key);
      }
      if (idx.code === -1 || idx.product_name === -1) {
        console.error('This does not look like an Open Food Facts CSV export (missing code/product_name columns).');
        process.exit(1);
      }
      continue;
    }
    const countries = (cols[idx.countries_tags] || '').toLowerCase();
    if (!countries.includes('india')) continue;

    const row = cleanRow(
      cols[idx.code],
      cols[idx.product_name],
      idx.brands >= 0 ? cols[idx.brands] : '',
      idx.categories_tags >= 0 ? (cols[idx.categories_tags] || '').split(',')[0]?.replace(/^en:/, '') : '',
      idx.image_url >= 0 ? cols[idx.image_url] : ''
    );
    if (!row) continue;

    batch.push(row);
    if (batch.length >= 500) {
      total += await upsertBatch(batch);
      batch = [];
      process.stdout.write(`\r${total} Indian products saved`);
    }
  }
  if (batch.length) total += await upsertBatch(batch);
  console.log(`\nDone. ${total} Indian products in BarcodeReference.`);
}

// ---------------------------------------------------------------------------
(async () => {
  const csvPath = process.argv[2];
  try {
    if (csvPath) await seedFromCsv(csvPath);
    else await seedFromApi();
  } finally {
    await prisma.$disconnect();
  }
})();
