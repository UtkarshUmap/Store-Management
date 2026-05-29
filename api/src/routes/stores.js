const router = require('express').Router();
const { z } = require('zod');
const QRCode = require('qrcode');
const prisma = require('../lib/prisma');
const { asyncHandler } = require('../lib/utils');
const { validate } = require('../middleware/error');
const { authenticate, authorize } = require('../middleware/auth');
const { requireStoreAccess } = require('../middleware/storeAccess');

function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// List stores owned by the current user (SUPER_ADMIN sees all).
// Includes a tiny stats payload per store so the admin's "All stores" page
// can show today's revenue + low-stock count inline without a per-card fetch.
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const where = req.user.role === 'SUPER_ADMIN' ? {} : { ownerId: req.user.id };
    const stores = await prisma.store.findMany({ where, orderBy: { createdAt: 'desc' } });
    if (!stores.length) return res.json({ stores });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const ids = stores.map((s) => s.id);

    const [todayAgg, lowStockGroups, productGroups] = await Promise.all([
      prisma.order.groupBy({
        by: ['storeId'],
        where: { storeId: { in: ids }, paymentStatus: 'SUCCESS', createdAt: { gte: startOfToday } },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      prisma.$queryRaw`
        SELECT store_id::text AS "storeId", COUNT(*)::int AS "lowCount"
        FROM products
        WHERE store_id = ANY(${ids}::uuid[])
          AND is_active = true
          AND stock_quantity <= minimum_stock
        GROUP BY store_id`,
      prisma.product.groupBy({
        by: ['storeId'],
        where: { storeId: { in: ids }, isActive: true },
        _count: { _all: true },
      }),
    ]);

    const byId = (arr, key) => Object.fromEntries(arr.map((r) => [r[key] || r.storeId, r]));
    const tAgg = byId(todayAgg, 'storeId');
    const lAgg = byId(lowStockGroups, 'storeId');
    const pAgg = byId(productGroups, 'storeId');

    const withStats = stores.map((s) => ({
      ...s,
      stats: {
        todayRevenue: Number(tAgg[s.id]?._sum?.totalAmount || 0),
        todayOrders: tAgg[s.id]?._count?._all || 0,
        lowStock: lAgg[s.id]?.lowCount || 0,
        products: pAgg[s.id]?._count?._all || 0,
      },
    }));
    res.json({ stores: withStats });
  })
);

router.post(
  '/',
  authenticate,
  authorize('STORE_OWNER', 'SUPER_ADMIN'),
  validate({
    body: z.object({
      storeName: z.string().min(2),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      postalCode: z.string().optional(),
      phone: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const base = slugify(req.body.storeName);
    const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const store = await prisma.store.create({
      data: { ...req.body, storeSlug: slug, ownerId: req.user.id },
    });

    // Generate a QR pointing at the public storefront and store it as a data URL.
    const url = `${process.env.PUBLIC_WEB_URL}/store/${slug}`;
    const qrDataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2 });
    const updated = await prisma.store.update({
      where: { id: store.id },
      data: { qrCodeUrl: qrDataUrl },
    });
    res.status(201).json({ store: updated, storefrontUrl: url });
  })
);

// Regenerate / fetch the QR for a store.
router.get(
  '/:storeId/qr',
  authenticate,
  requireStoreAccess,
  asyncHandler(async (req, res) => {
    const url = `${process.env.PUBLIC_WEB_URL}/store/${req.store.storeSlug}`;
    const qrDataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2 });
    await prisma.store.update({ where: { id: req.store.id }, data: { qrCodeUrl: qrDataUrl } });
    res.json({ qrCodeUrl: qrDataUrl, storefrontUrl: url });
  })
);

router.put(
  '/:storeId',
  authenticate,
  requireStoreAccess,
  validate({
    body: z.object({
      storeName: z.string().min(2).optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      postalCode: z.string().optional(),
      phone: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const store = await prisma.store.update({
      where: { id: req.store.id },
      data: req.body,
    });
    res.json({ store });
  })
);

module.exports = router;
