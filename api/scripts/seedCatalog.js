/**
 * Seed the centralized master catalog (master_categories + master_products)
 * with real general-store / kirana products across 12 fixed categories.
 *
 * Sources (all free, open APIs — no scraping):
 *   openfoodfacts     -> grocery, dairy, snacks, beverages, bakery, frozen, baby
 *   openbeautyfacts   -> personal care (shampoo, soap, toothpaste)
 *   openproductsfacts -> home care, stationery
 *   openpetfoodfacts  -> pet food
 *
 * NOTE ON PRICES: none of these carry retail prices, and no free API does for
 * India. `referencePrice` is left null; the shop owner sets his own selling
 * price when adding. Curated fallbacks cover categories the open DBs barely
 * index (fresh produce, stationery) so no category ships empty.
 *
 * Run:  DATABASE_URL=... node scripts/seedCatalog.js
 */
const prisma = require('../src/lib/prisma');

const DOMAINS = {
  openfoodfacts: 'https://world.openfoodfacts.org',
  openbeautyfacts: 'https://world.openbeautyfacts.org',
  openproductsfacts: 'https://world.openproductsfacts.org',
  openpetfoodfacts: 'https://world.openpetfoodfacts.org',
};

// The 12 target categories -> which open DB + which category tags to pull.
const CATEGORIES = [
  { name: 'Grocery', source: 'openfoodfacts',
    tags: ['rices', 'flours', 'lentils', 'legumes', 'pastas', 'spices', 'condiments', 'vegetable-oils', 'salts', 'sugars'] },
  { name: 'Dairy', source: 'openfoodfacts',
    tags: ['milks', 'butters', 'cheeses', 'yogurts', 'creams'] },
  { name: 'Snacks', source: 'openfoodfacts',
    tags: ['chips-and-fries', 'crisps', 'salty-snacks', 'biscuits', 'cookies', 'chocolates', 'candies', 'nuts', 'dried-fruits'] },
  { name: 'Beverages', source: 'openfoodfacts',
    tags: ['sodas', 'fruit-juices', 'waters', 'teas', 'coffees', 'energy-drinks'] },
  { name: 'Personal Care', source: 'openbeautyfacts',
    tags: ['shampoos', 'soaps', 'toothpastes', 'deodorants', 'hair-care', 'skin-care'] },
  { name: 'Home Care', source: 'openproductsfacts',
    tags: ['cleaning', 'laundry', 'household'] },
  { name: 'Baby Care', source: 'openfoodfacts',
    tags: ['baby-foods', 'infant-formulas', 'baby-milks'] },
  { name: 'Frozen Foods', source: 'openfoodfacts',
    tags: ['frozen-foods', 'ice-creams', 'frozen-desserts'] },
  { name: 'Bakery', source: 'openfoodfacts',
    tags: ['breads', 'cakes', 'viennoiseries', 'pastries'] },
  { name: 'Stationery', source: 'openproductsfacts',
    tags: ['stationery', 'office-supplies'] },
  { name: 'Pet Food', source: 'openpetfoodfacts',
    tags: ['cat-food', 'dog-food', 'pet-food'] },
  { name: 'Fruits & Vegetables', source: 'openfoodfacts',
    tags: ['fresh-vegetables', 'fresh-fruits', 'vegetables', 'fruits'] },
];

// Open DBs barely index loose produce and stationery (they're not barcoded),
// so these categories get a curated baseline of common Indian kirana items.
const CURATED = {
  // Indian staples a kirana always stocks — rice, atta, dal, oil, salt, masala.
  Grocery: [
    'Aashirvaad Atta 5kg', 'Aashirvaad Atta 10kg', 'Pillsbury Chakki Fresh Atta 5kg',
    'Fortune Chakki Fresh Atta 5kg', 'India Gate Basmati Rice 1kg',
    'Daawat Rozana Basmati Rice 5kg', 'Kohinoor Basmati Rice 1kg', 'Sona Masoori Rice 5kg',
    'Toor Dal (Arhar) 1kg', 'Moong Dal 1kg', 'Chana Dal 1kg', 'Masoor Dal 1kg',
    'Urad Dal 1kg', 'Rajma 1kg', 'Kabuli Chana 1kg', 'Besan 500g',
    'Tata Salt 1kg', 'Tata Sampann Haldi Powder 200g', 'Everest Garam Masala 100g',
    'MDH Deggi Mirch 100g', 'Catch Red Chilli Powder 200g', 'Everest Turmeric Powder 200g',
    'Fortune Sunflower Oil 1L', 'Saffola Gold Oil 1L', 'Dhara Mustard Oil 1L',
    'Amul Ghee 1L', 'Sugar 1kg', 'Jaggery (Gud) 1kg', 'Sooji / Rava 500g',
    'Poha 500g', 'Maida 1kg', 'Sabudana 500g',
  ],
  Dairy: [
    'Amul Butter 100g', 'Amul Butter 500g', 'Amul Cheese Slices 200g',
    'Amul Cheese Cubes 200g', 'Amul Processed Cheese Block 400g', 'Britannia Cheese Slices',
    'Amul Taaza Toned Milk 1L', 'Amul Gold Full Cream Milk 1L', 'Amul Masti Dahi 400g',
    'Mother Dairy Full Cream Milk 1L', 'Mother Dairy Dahi 400g', 'Nestle A+ Dahi 400g',
    'Amul Paneer 200g', 'Mother Dairy Paneer 200g', 'Amul Ghee 500ml',
    'Amul Fresh Cream 250ml', 'Amul Lassi 200ml', 'Amul Kool Badam 200ml',
  ],
  Beverages: [
    'Thums Up 750ml', 'Thums Up 2L', 'Coca-Cola 750ml', 'Sprite 750ml',
    'Limca 750ml', 'Fanta 750ml', 'Pepsi 750ml', 'Mountain Dew 750ml',
    'Maaza Mango 600ml', 'Frooti 200ml', 'Slice Mango 600ml', 'Real Mixed Fruit Juice 1L',
    'Tropicana Orange Juice 1L', 'Bisleri Water 1L', 'Kinley Water 1L', 'Aquafina Water 1L',
    'Tata Tea Premium 500g', 'Red Label Tea 500g', 'Taj Mahal Tea 250g',
    'Nescafe Classic 50g', 'Bru Instant Coffee 100g', 'Rooh Afza 750ml',
    'Sting Energy Drink 250ml', 'Appy Fizz 600ml',
  ],
  Snacks: [
    'Parle-G Biscuit 100g', 'Britannia Good Day Cashew', 'Britannia Marie Gold',
    'Sunfeast Dark Fantasy', 'Oreo Biscuit 120g', 'Hide & Seek Biscuit',
    'Maggi 2-Minute Noodles 70g', 'Maggi Masala 12 Pack', 'Yippee Noodles',
    'Lays Classic Salted 52g', 'Lays Magic Masala 52g', 'Kurkure Masala Munch 90g',
    'Bingo Mad Angles', 'Haldiram Aloo Bhujia 200g', 'Haldiram Navratan Mix 200g',
    'Cadbury Dairy Milk 55g', 'Cadbury 5 Star', 'KitKat 4 Finger', 'Perk Chocolate',
    'Munch Chocolate', 'Bourbon Biscuit', 'Monaco Biscuit', 'Krackjack Biscuit',
  ],
  'Personal Care': [
    'Dove Cream Beauty Bar 100g', 'Lux Soap 100g', 'Lifebuoy Total Soap 100g',
    'Santoor Sandal Soap 100g', 'Medimix Soap 125g', 'Dettol Original Soap 125g',
    'Clinic Plus Shampoo 175ml', 'Sunsilk Shampoo 180ml', 'Head & Shoulders 180ml',
    'Dove Shampoo 180ml', 'Pantene Shampoo 180ml',
    'Colgate Strong Teeth 200g', 'Close Up Toothpaste 150g', 'Pepsodent 150g',
    'Dabur Red Toothpaste 200g', 'Colgate Toothbrush',
    'Parachute Coconut Oil 200ml', 'Dabur Amla Hair Oil 200ml', 'Navratna Oil 100ml',
    'Nivea Cream 100ml', 'Ponds Powder 100g', 'Vaseline Lotion 200ml',
    'Glow & Lovely Cream 50g', 'Gillette Razor', 'Old Spice Deodorant 150ml',
    'Fogg Deodorant 150ml', 'Whisper Sanitary Pads', 'Stayfree Sanitary Pads',
  ],
  'Home Care': [
    'Surf Excel Easy Wash 1kg', 'Ariel Detergent Powder 1kg', 'Tide Plus 1kg',
    'Rin Detergent Bar', 'Wheel Detergent Powder 1kg', 'Nirma Washing Powder 1kg',
    'Surf Excel Matic Liquid 1L', 'Comfort Fabric Conditioner 800ml',
    'Vim Dishwash Bar 200g', 'Vim Dishwash Gel 500ml', 'Pril Dishwash Liquid 425ml',
    'Harpic Toilet Cleaner 500ml', 'Lizol Floor Cleaner 975ml', 'Colin Glass Cleaner 500ml',
    'Domex Toilet Cleaner 500ml', 'Scotch Brite Scrub Pad', 'Exo Dishwash Bar',
    'Good Knight Refill', 'All Out Refill', 'Odonil Air Freshener',
    'Hit Cockroach Spray', 'Garbage Bags Medium', 'Phenyl 1L',
  ],
  'Baby Care': [
    'Cerelac Wheat Apple 300g', 'Cerelac Rice 300g', 'Nestle Lactogen 1 400g',
    'Nan Pro 1 400g', 'Pampers Pants Medium', 'Huggies Wonder Pants Medium',
    'MamyPoko Pants Medium', 'Johnson Baby Powder 200g', 'Johnson Baby Soap 100g',
    'Johnson Baby Oil 200ml', 'Johnson Baby Shampoo 200ml', 'Himalaya Baby Lotion 200ml',
    'Himalaya Baby Powder 200g', 'Dabur Lal Tail 100ml', 'Baby Wipes 72 Pack',
  ],
  'Frozen Foods': [
    'McCain French Fries 420g', 'McCain Aloo Tikki 400g', 'McCain Smiles 415g',
    'Amul Ice Cream Vanilla 1L', 'Amul Ice Cream Butterscotch 1L',
    'Kwality Walls Cornetto', 'Kwality Walls Cassata', 'Vadilal Ice Cream 1L',
    'Safal Frozen Green Peas 500g', 'Frozen Sweet Corn 500g',
    'ITC Master Chef Prawns', 'Frozen Paratha 5 Pack', 'Frozen Chicken Nuggets',
  ],
  Bakery: [
    'Britannia Bread 400g', 'Modern Bread 400g', 'Harvest Gold Bread 400g',
    'Britannia Brown Bread 400g', 'Pav Bun 6 Pack', 'Burger Bun 4 Pack',
    'Britannia Rusk 200g', 'Parle Rusk 200g', 'Britannia Fruit Cake 250g',
    'Britannia Plum Cake', 'Winkies Muffin', 'Britannia Cheese Croissant',
  ],
  'Pet Food': [
    'Pedigree Adult Dog Food 1kg', 'Pedigree Puppy 1kg', 'Drools Adult Dog Food 1.2kg',
    'Drools Puppy 1.2kg', 'Whiskas Adult Cat Food 480g', 'Whiskas Kitten 450g',
    'Royal Canin Adult Dog 1kg', 'Purepet Dog Food 1kg', 'Meat Up Dog Food 1kg',
    'Pedigree Gravy Pouch 70g', 'Sheba Cat Food Pouch',
  ],
  Stationery: [
    'Classmate Notebook 172 Pages', 'Classmate Long Notebook', 'Camlin Pencil Box',
    'Natraj 621 Pencil', 'Apsara Platinum Pencil', 'Reynolds 045 Ball Pen',
    'Cello Butterflow Pen', 'Nataraj Eraser', 'Camlin Sharpener', 'Camlin Geometry Box',
    'A4 Copier Paper Ream', 'Fevicol 50g', 'Fevistick Glue Stick', 'Scale 15cm',
    'Sketch Pens Set', 'Crayons 24 Shades', 'Stapler No. 10', 'Stapler Pins',
    'Sticky Notes Pad', 'File Folder', 'Highlighter Pen', 'Whitener Pen',
  ],
  'Fruits & Vegetables': [
    'Onion 1kg', 'Potato 1kg', 'Tomato 1kg', 'Ginger 250g', 'Garlic 250g',
    'Green Chilli 250g', 'Coriander Bunch', 'Curry Leaves', 'Lemon 500g',
    'Carrot 500g', 'Cabbage 1pc', 'Cauliflower 1pc', 'Brinjal 500g',
    'Lady Finger 500g', 'Capsicum 500g', 'Spinach Bunch', 'Bottle Gourd 1pc',
    'Cucumber 500g', 'Banana 1 Dozen', 'Apple 1kg', 'Orange 1kg', 'Mango 1kg',
    'Grapes 500g', 'Pomegranate 1kg', 'Watermelon 1pc', 'Papaya 1pc',
  ],
};

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Open*Facts names are crowdsourced, so they arrive as "fortune sun lite
// sunflower oil 15 litre", "AMUL BUTTER", or even just a barcode. Tidy them so
// the catalog reads like a shop shelf rather than a database dump.
const SMALL_WORDS = new Set(['a', 'an', 'and', 'in', 'of', 'or', 'the', 'with', 'for']);
const KEEP_UPPER = new Set(['ml', 'g', 'kg', 'l', 'uht']);

function cleanName(raw) {
  let n = (raw || '')
    .replace(/\s+/g, ' ')
    .replace(/[_*]+/g, ' ')
    .trim();
  if (!n) return null;
  // A name that's just a barcode / number is junk data, not a product.
  if (/^[\d\s-]+$/.test(n)) return null;
  if (n.length < 3) return null;

  // Only re-case names that are shouting or entirely lowercase; leave names
  // that already have deliberate casing ("Too Yumm! K-Bomb") alone.
  const isAllCaps = n === n.toUpperCase() && /[A-Z]{3,}/.test(n);
  const isAllLower = n === n.toLowerCase();
  if (isAllCaps || isAllLower) {
    n = n
      .toLowerCase()
      .split(' ')
      .map((w, i) => {
        if (i > 0 && SMALL_WORDS.has(w)) return w;
        if (KEEP_UPPER.has(w.replace(/[^a-z]/g, ''))) return w;
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(' ');
  }
  // Tidy unit spellings: "15 litre" -> "15 L", "500 gram" -> "500 g"
  n = n
    .replace(/(\d+)\s*(litres?|liters?)\b/gi, '$1 L')
    .replace(/(\d+)\s*(grams?|gms?)\b/gi, '$1 g')
    .replace(/(\d+)\s*(kilograms?|kgs?)\b/gi, '$1 kg');
  return n.slice(0, 90);
}

async function search(source, tag, country) {
  const url =
    `${DOMAINS[source]}/api/v2/search` +
    `?categories_tags=${encodeURIComponent(tag)}` +
    (country ? `&countries_tags=${country}` : '') +
    `&fields=code,product_name,brands,image_url,quantity` +
    `&sort_by=unique_scans_n&page_size=100&page=1`;
  // Open*Facts throttles bursts with 503/429 — retry with exponential backoff.
  let lastErr;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'StoreApp-Catalog-Seeder/1.0 (nextgenventures.in@gmail.com)' },
      });
      if (res.status === 503 || res.status === 429) {
        lastErr = new Error(`HTTP ${res.status}`);
        await sleep(attempt * 3000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()).products || [];
    } catch (e) {
      lastErr = e;
      await sleep(attempt * 2000);
    }
  }
  throw new Error(`${source}/${tag} -> ${lastErr?.message || 'failed'}`);
}

// India ONLY. These open DBs are French-origin, so an unfiltered query returns
// mostly European items ("Lentilles Carrefour") that are useless to an Indian
// kirana. We never fall back to the global pool — where India coverage is thin,
// the curated Indian lists below fill the category instead.
async function fetchTag(source, tag) {
  return search(source, tag, 'india');
}

async function main() {
  // Full rebuild: the catalog is derived data (store products are independent
  // copies), so wipe it rather than upserting on top of a previous run — that
  // would strand rows from an earlier, differently-scoped seed.
  const wiped = await prisma.masterProduct.deleteMany({});
  const keep = CATEGORIES.map((c) => c.name);
  await prisma.masterCategory.deleteMany({ where: { name: { notIn: keep } } });
  console.log(`Cleared ${wiped.count} old catalog products. Rebuilding (India-first)…`);

  for (const [i, cat] of CATEGORIES.entries()) {
    const category = await prisma.masterCategory.upsert({
      where: { name: cat.name },
      update: { sortOrder: i },
      create: { name: cat.name, slug: slugify(cat.name), sortOrder: i },
    });

    const seen = new Set();
    let n = 0;

    for (const tag of cat.tags) {
      let products = [];
      try {
        products = await fetchTag(cat.source, tag);
      } catch (e) {
        console.warn(`  ! ${cat.name}/${tag}: ${e.message}`);
        continue;
      }

      for (const p of products) {
        const code = (p.code || '').trim();
        const name = cleanName(p.product_name);
        const image = (p.image_url || '').trim();
        // cleanName returns null for barcode-as-name / too-short junk entries.
        if (!code || !name || !image || seen.has(code)) continue;
        seen.add(code);

        const brand = cleanName((p.brands || '').split(',')[0]) || null;
        try {
          await prisma.masterProduct.upsert({
            where: { sourcePlatform_externalId: { sourcePlatform: cat.source, externalId: code } },
            update: { name, brand, imageUrl: image, unit: p.quantity || null, categoryId: category.id },
            create: {
              categoryId: category.id,
              name,
              brand,
              description: [brand, p.quantity].filter(Boolean).join(' · ') || null,
              imageUrl: image,
              unit: p.quantity || null,
              sourcePlatform: cat.source,
              sourceUrl: `${DOMAINS[cat.source]}/product/${code}`,
              externalId: code,
            },
          });
          n++;
        } catch {
          /* skip individual row failures */
        }
      }
      await sleep(600); // be polite to the API
    }

    // Curated baseline for categories the open DBs don't index well.
    for (const name of CURATED[cat.name] || []) {
      try {
        await prisma.masterProduct.upsert({
          where: { sourcePlatform_externalId: { sourcePlatform: 'curated', externalId: slugify(name) } },
          update: { name, categoryId: category.id },
          create: {
            categoryId: category.id,
            name,
            sourcePlatform: 'curated',
            externalId: slugify(name),
          },
        });
        n++;
      } catch {
        /* ignore */
      }
    }

    console.log(`✓ ${cat.name}: ${n} products`);
  }

  const grand = await prisma.masterProduct.count();
  console.log(`\nDone. Catalog now has ${grand} products across ${CATEGORIES.length} categories.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
