const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { asyncHandler, ApiError } = require('../lib/utils');
const { validate } = require('../middleware/error');
const { authenticate } = require('../middleware/auth');
const { requireStoreAccess } = require('../middleware/storeAccess');
const { adjustStock } = require('../lib/inventory');
const { lookupProductByBarcode, normalizeBarcode } = require('../lib/barcode');

// ---------------- Categories ----------------
router.get(
  '/:storeId/categories',
  authenticate,
  requireStoreAccess,
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
      where: { storeId: req.store.id },
      orderBy: { name: 'asc' },
    });
    res.json({ categories });
  })
);

router.post(
  '/:storeId/categories',
  authenticate,
  requireStoreAccess,
  validate({ body: z.object({ name: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.create({
      data: { name: req.body.name, storeId: req.store.id },
    });
    res.status(201).json({ category });
  })
);

// ---------------- Products ----------------
const productBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional().nullable(),
  barcode: z.string().optional(),
  sku: z.string().optional(),
  price: z.coerce.number().nonnegative(),
  costPrice: z.coerce.number().nonnegative().optional(),
  stockQuantity: z.coerce.number().int().min(0).optional(),
  minimumStock: z.coerce.number().int().min(0).optional(),
  imageUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
});

router.get(
  '/:storeId/products',
  authenticate,
  requireStoreAccess,
  asyncHandler(async (req, res) => {
    const products = await prisma.product.findMany({
      where: { storeId: req.store.id },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ products });
  })
);

router.get(
  '/:storeId/products/lookup',
  authenticate,
  requireStoreAccess,
  validate({ query: z.object({ barcode: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const barcode = normalizeBarcode(req.query.barcode);
    if (!barcode) {
      throw new ApiError(400, 'Barcode is required');
    }

    const existing = await prisma.product.findFirst({
      where: { storeId: req.store.id, barcode },
      include: { category: true },
    });
    if (existing) {
      return res.json({ source: 'db', product: existing });
    }

    const externalProduct = await lookupProductByBarcode(barcode);
    if (externalProduct) {
      return res.json({ source: 'external', product: externalProduct });
    }

    throw new ApiError(404, 'No product found for barcode');
  })
);

router.post(
  '/:storeId/products',
  authenticate,
  requireStoreAccess,
  validate({ body: productBody }),
  asyncHandler(async (req, res) => {
    const data = { ...req.body, storeId: req.store.id };
    const product = await prisma.product.create({ data });
    // seed the inventory log so opening stock is auditable
    if (product.stockQuantity > 0) {
      await prisma.inventoryLog.create({
        data: {
          storeId: req.store.id,
          productId: product.id,
          action: 'MANUAL_EDIT',
          quantityChange: product.stockQuantity,
          previousStock: 0,
          newStock: product.stockQuantity,
          note: 'Initial stock',
        },
      });
    }
    res.status(201).json({ product });
  })
);

router.put(
  '/:storeId/products/:productId',
  authenticate,
  requireStoreAccess,
  validate({ body: productBody.partial() }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.productId, storeId: req.store.id },
    });
    if (!existing) throw new ApiError(404, 'Product not found');

    const body = { ...req.body };
    // If stock is being changed directly, route it through adjustStock for an audit log.
    if (body.stockQuantity !== undefined && body.stockQuantity !== existing.stockQuantity) {
      const diff = body.stockQuantity - existing.stockQuantity;
      delete body.stockQuantity;
      await prisma.$transaction(async (tx) => {
        if (Object.keys(body).length) {
          await tx.product.update({ where: { id: existing.id }, data: body });
        }
        await adjustStock(tx, {
          storeId: req.store.id,
          productId: existing.id,
          action: 'MANUAL_EDIT',
          quantityChange: diff,
          note: 'Manual stock edit',
        });
      });
    } else {
      await prisma.product.update({ where: { id: existing.id }, data: body });
    }
    const product = await prisma.product.findUnique({ where: { id: existing.id } });
    res.json({ product });
  })
);

router.delete(
  '/:storeId/products/:productId',
  authenticate,
  requireStoreAccess,
  asyncHandler(async (req, res) => {
    // Soft-delete: keep the row so historical orders still resolve.
    await prisma.product.update({
      where: { id: req.params.productId },
      data: { isActive: false },
    });
    res.json({ ok: true });
  })
);

// ---------------- Restock ----------------
router.post(
  '/:storeId/products/:productId/restock',
  authenticate,
  requireStoreAccess,
  validate({
    body: z.object({
      quantity: z.coerce.number().int().positive(),
      supplierName: z.string().optional(),
      purchasePrice: z.coerce.number().nonnegative().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { quantity, supplierName, purchasePrice } = req.body;
    const result = await prisma.$transaction(async (tx) => {
      const adj = await adjustStock(tx, {
        storeId: req.store.id,
        productId: req.params.productId,
        action: 'RESTOCK',
        quantityChange: quantity,
        note: supplierName ? `Restock from ${supplierName}` : 'Restock',
      });
      await tx.restock.create({
        data: {
          storeId: req.store.id,
          productId: req.params.productId,
          quantity,
          supplierName,
          purchasePrice: purchasePrice !== undefined ? purchasePrice.toFixed(2) : null,
        },
      });
      return adj;
    });
    res.json({ ok: true, ...result });
  })
);

// ---------------- Inventory log ----------------
router.get(
  '/:storeId/inventory-logs',
  authenticate,
  requireStoreAccess,
  asyncHandler(async (req, res) => {
    const logs = await prisma.inventoryLog.findMany({
      where: { storeId: req.store.id },
      include: { product: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ logs });
  })
);

module.exports = router;
