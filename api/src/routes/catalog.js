// ---------------------------------------------------------------------------
// Centralized master catalog API. Shop owners browse this store-agnostic
// product library (seeded from Open* Facts), search within a category, and
// one-click "+ Add" a product into their own store. Prices are snapshots;
// a per-product refresh pulls a live price via the scraper.
// ---------------------------------------------------------------------------
const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { asyncHandler, ApiError, money } = require('../lib/utils');
const { validate } = require('../middleware/error');
const { authenticate } = require('../middleware/auth');
const { requireStoreAccess } = require('../middleware/storeAccess');

// ---- Categories (with product counts) ----
router.get(
  '/categories',
  authenticate,
  asyncHandler(async (_req, res) => {
    const cats = await prisma.masterCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { products: true } },
        // One real product photo per category, so the category tiles can show
        // artwork instead of a bare letter.
        products: {
          where: { imageUrl: { not: null } },
          select: { imageUrl: true },
          take: 1,
        },
      },
    });
    res.json({
      categories: cats.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        imageUrl: c.imageUrl || c.products[0]?.imageUrl || null,
        productCount: c._count.products,
      })),
    });
  })
);

// ---- Browse / search products (paginated by cursor) ----
router.get(
  '/products',
  authenticate,
  validate({
    query: z.object({
      category: z.string().optional(), // category id or slug
      q: z.string().optional(),
      cursor: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(60).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const take = req.query.limit || 40;
    const where = {};
    if (req.query.category) {
      const key = req.query.category;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
      const cat = await prisma.masterCategory.findFirst({
        // The UI sends the category id; slug/name are accepted too.
        where: { OR: [...(isUuid ? [{ id: key }] : []), { slug: key }, { name: key }] },
        select: { id: true },
      });
      if (!cat) throw new ApiError(404, 'Category not found');
      where.categoryId = cat.id;
    }
    if (req.query.q) where.name = { contains: req.query.q.trim(), mode: 'insensitive' };

    const rows = await prisma.masterProduct.findMany({
      where,
      take: take + 1,
      ...(req.query.cursor ? { skip: 1, cursor: { id: req.query.cursor } } : {}),
      orderBy: { id: 'asc' },
      include: { category: { select: { name: true } } },
    });

    const hasMore = rows.length > take;
    const products = rows.slice(0, take).map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      description: p.description,
      imageUrl: p.imageUrl,
      unit: p.unit,
      referencePrice: p.referencePrice,
      mrp: p.mrp,
      categoryName: p.category?.name || null,
      source: p.sourcePlatform,
    }));
    res.json({ products, nextCursor: hasMore ? products[products.length - 1].id : null });
  })
);

// ---- One-click add a catalog product into the owner's store ----
router.post(
  '/stores/:storeId/from-catalog',
  authenticate,
  requireStoreAccess,
  validate({
    body: z.object({
      masterProductId: z.string().uuid(),
      price: z.coerce.number().nonnegative().optional(),
      stockQuantity: z.coerce.number().int().min(0).optional(),
      minimumStock: z.coerce.number().int().min(0).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const master = await prisma.masterProduct.findUnique({
      where: { id: req.body.masterProductId },
      include: { category: true },
    });
    if (!master) throw new ApiError(404, 'Catalog product not found');

    // Mirror the master category into a per-store category (find or create).
    let categoryId = null;
    if (master.category) {
      const existing = await prisma.category.findFirst({
        where: { storeId: req.store.id, name: master.category.name },
      });
      categoryId = existing
        ? existing.id
        : (await prisma.category.create({
            data: { storeId: req.store.id, name: master.category.name },
          })).id;
    }

    const price =
      req.body.price != null ? req.body.price : Number(master.referencePrice || 0);
    const stockQuantity = req.body.stockQuantity ?? 0;

    const product = await prisma.product.create({
      data: {
        storeId: req.store.id,
        categoryId,
        name: master.name,
        description: master.description,
        barcode: master.sourcePlatform === 'openfoodfacts' ? master.externalId : null,
        price: money(price),
        stockQuantity,
        minimumStock: req.body.minimumStock ?? 5,
        imageUrl: master.imageUrl,
      },
    });

    if (stockQuantity > 0) {
      await prisma.inventoryLog.create({
        data: {
          storeId: req.store.id,
          productId: product.id,
          action: 'MANUAL_EDIT',
          quantityChange: stockQuantity,
          previousStock: 0,
          newStock: stockQuantity,
          note: 'Added from catalog',
        },
      });
    }
    res.status(201).json({ product });
  })
);

// ---- Bulk add: many catalog products into the store in ONE request ----
// The UI used to POST once per product, so adding 30 items meant 30 sequential
// round trips. This collapses the whole batch into a handful of queries.
router.post(
  '/stores/:storeId/from-catalog/bulk',
  authenticate,
  requireStoreAccess,
  validate({
    body: z.object({
      items: z
        .array(
          z.object({
            masterProductId: z.string().uuid(),
            price: z.coerce.number().nonnegative(),
            stockQuantity: z.coerce.number().int().min(0).optional(),
            minimumStock: z.coerce.number().int().min(0).optional(),
          })
        )
        .min(1)
        .max(200),
    }),
  }),
  asyncHandler(async (req, res) => {
    const storeId = req.store.id;
    const items = req.body.items;

    // 1. All the master products in one go.
    const masters = await prisma.masterProduct.findMany({
      where: { id: { in: items.map((i) => i.masterProductId) } },
      include: { category: true },
    });
    const masterById = new Map(masters.map((m) => [m.id, m]));
    if (!masters.length) throw new ApiError(404, 'No matching catalog products');

    // 2. Mirror the master categories into this store, creating only the missing ones.
    const wantedNames = [...new Set(masters.map((m) => m.category?.name).filter(Boolean))];
    const existing = await prisma.category.findMany({
      where: { storeId, name: { in: wantedNames } },
    });
    const catIdByName = new Map(existing.map((c) => [c.name, c.id]));
    const missing = wantedNames.filter((n) => !catIdByName.has(n));
    if (missing.length) {
      await prisma.category.createMany({
        data: missing.map((name) => ({ storeId, name })),
        skipDuplicates: true,
      });
      const created = await prisma.category.findMany({
        where: { storeId, name: { in: missing } },
      });
      created.forEach((c) => catIdByName.set(c.name, c.id));
    }

    // 3. Create every product in a single batched transaction.
    const creates = [];
    for (const item of items) {
      const m = masterById.get(item.masterProductId);
      if (!m) continue;
      creates.push(
        prisma.product.create({
          data: {
            storeId,
            categoryId: m.category ? catIdByName.get(m.category.name) || null : null,
            name: m.name,
            description: m.description,
            barcode: m.sourcePlatform === 'openfoodfacts' ? m.externalId : null,
            price: money(item.price),
            stockQuantity: item.stockQuantity ?? 0,
            minimumStock: item.minimumStock ?? 5,
            imageUrl: m.imageUrl,
          },
        })
      );
    }
    const products = await prisma.$transaction(creates);

    // 4. Opening-stock audit rows, also batched.
    const logs = products
      .filter((p) => p.stockQuantity > 0)
      .map((p) => ({
        storeId,
        productId: p.id,
        action: 'MANUAL_EDIT',
        quantityChange: p.stockQuantity,
        previousStock: 0,
        newStock: p.stockQuantity,
        note: 'Added from catalog',
      }));
    if (logs.length) await prisma.inventoryLog.createMany({ data: logs });

    res.status(201).json({ added: products.length, products });
  })
);

module.exports = router;
