const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { asyncHandler, ApiError, generateOrderNumber, money } = require('../lib/utils');
const { validate } = require('../middleware/error');
const { adjustStock } = require('../lib/inventory');
const rz = require('../lib/razorpay');

// Soft auth: if a Bearer token is present and valid, attach req.user;
// otherwise continue anonymously. Used by /checkout so a logged-in CUSTOMER's
// order is linked back to them, without breaking the anonymous QR-scan flow.
function softAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      /* ignore — treat as anonymous */
    }
  }
  next();
}

// ---- Public: cross-store product catalog (the "shop" landing) ----
// Used by the customer-facing /shop page. Supports search, category filter
// (by category name match across stores), and store filter.
router.get(
  '/catalog',
  asyncHandler(async (req, res) => {
    const q = (req.query.q || '').toString().trim();
    const storeSlug = (req.query.store || '').toString().trim();
    const category = (req.query.category || '').toString().trim();
    const take = Math.min(Math.max(parseInt(req.query.limit, 10) || 60, 1), 120);

    const where = { isActive: true };
    if (q) where.name = { contains: q, mode: 'insensitive' };
    if (storeSlug) where.store = { storeSlug };
    if (category) where.category = { name: { equals: category, mode: 'insensitive' } };

    const products = await prisma.product.findMany({
      where,
      take,
      orderBy: [{ stockQuantity: 'desc' }, { createdAt: 'desc' }],
      include: {
        category: { select: { name: true } },
        store: { select: { id: true, storeName: true, storeSlug: true, city: true } },
      },
    });

    res.json({
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        imageUrl: p.imageUrl,
        inStock: p.stockQuantity > 0,
        stockQuantity: p.stockQuantity,
        categoryName: p.category?.name || null,
        store: p.store,
      })),
    });
  })
);

// ---- Public: list all stores (used by the catalog's store filter) ----
router.get(
  '/stores',
  asyncHandler(async (_req, res) => {
    const stores = await prisma.store.findMany({
      orderBy: { storeName: 'asc' },
      select: { id: true, storeName: true, storeSlug: true, city: true },
    });
    res.json({ stores });
  })
);

// ---- Public: list all distinct category names across stores ----
router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const cats = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { name: true },
    });
    const seen = new Set();
    const out = [];
    for (const c of cats) {
      const k = c.name.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(c.name);
      }
    }
    res.json({ categories: out });
  })
);

// ---- Public: fetch a storefront by slug (no auth) ----
router.get(
  '/storefront/:slug',
  asyncHandler(async (req, res) => {
    const store = await prisma.store.findUnique({
      where: { storeSlug: req.params.slug },
      select: { id: true, storeName: true, storeSlug: true, city: true, phone: true },
    });
    if (!store) throw new ApiError(404, 'Store not found');

    const products = await prisma.product.findMany({
      where: { storeId: store.id, isActive: true },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    const categories = await prisma.category.findMany({ where: { storeId: store.id } });
    res.json({
      store,
      categories,
      // expose only what a customer needs; hide cost_price etc.
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        imageUrl: p.imageUrl,
        inStock: p.stockQuantity > 0,
        stockQuantity: p.stockQuantity,
        categoryId: p.categoryId,
        categoryName: p.category?.name || null,
      })),
    });
  })
);

const checkoutSchema = z.object({
  storeSlug: z.string(),
  paymentMethod: z.enum(['RAZORPAY', 'CASH']),
  customer: z
    .object({
      fullName: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
    })
    .optional(),
  items: z
    .array(z.object({ productId: z.string().uuid(), quantity: z.coerce.number().int().positive() }))
    .min(1),
});

// ---- Create an order. Prices are recomputed server-side (never trust client). ----
// CASH  -> order created COMPLETED/SUCCESS, stock decremented.
// RAZORPAY -> Razorpay order is created FIRST; only then do we open the DB
//            transaction to decrement stock and persist the order. That way a
//            Razorpay failure can never leave stock held with no order in hand.
router.post(
  '/checkout',
  softAuth,
  validate({ body: checkoutSchema }),
  asyncHandler(async (req, res) => {
    const { storeSlug, paymentMethod, customer, items } = req.body;
    // If the caller is a logged-in CUSTOMER, link the order to them.
    const placedByUserId =
      req.user && req.user.role === 'CUSTOMER' ? req.user.id : null;

    const store = await prisma.store.findUnique({ where: { storeSlug } });
    if (!store) throw new ApiError(404, 'Store not found');

    if (paymentMethod === 'RAZORPAY' && !rz.isConfigured()) {
      throw new ApiError(503, 'Online payments not configured');
    }

    // Snapshot products + recompute prices server-side (never trust the client).
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, storeId: store.id, isActive: true },
    });
    const byId = Object.fromEntries(products.map((p) => [p.id, p]));

    let subtotal = 0;
    const orderItemsData = [];
    for (const item of items) {
      const p = byId[item.productId];
      if (!p) throw new ApiError(400, `Product ${item.productId} unavailable`);
      const lineTotal = Number(p.price) * item.quantity;
      subtotal += lineTotal;
      orderItemsData.push({
        productId: p.id,
        productName: p.name,
        unitPrice: money(p.price),
        quantity: item.quantity,
        totalPrice: money(lineTotal),
      });
    }
    const total = subtotal; // tax/discount hooks can slot in here
    const orderNumber = generateOrderNumber();

    // Create the Razorpay order BEFORE we touch stock. If this throws, no DB
    // state has been mutated and there's nothing to roll back.
    let rzOrder = null;
    if (paymentMethod === 'RAZORPAY') {
      rzOrder = await rz.createRazorpayOrder({
        amountRupees: total,
        receipt: orderNumber,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      let customerId = null;
      if (customer && (customer.phone || customer.email || customer.fullName)) {
        const c = await tx.customer.create({ data: { storeId: store.id, ...customer } });
        customerId = c.id;
      }

      const order = await tx.order.create({
        data: {
          storeId: store.id,
          customerId,
          placedByUserId,
          orderNumber,
          subtotal: money(subtotal),
          taxAmount: money(0),
          discountAmount: money(0),
          totalAmount: money(total),
          paymentMethod,
          paymentStatus: paymentMethod === 'CASH' ? 'SUCCESS' : 'PENDING',
          orderStatus: paymentMethod === 'CASH' ? 'COMPLETED' : 'PLACED',
          items: { create: orderItemsData },
        },
      });

      // Decrement stock + log, atomically, for every line.
      for (const item of items) {
        await adjustStock(tx, {
          storeId: store.id,
          productId: item.productId,
          action: 'SALE',
          quantityChange: -item.quantity,
          note: `Order ${order.orderNumber}`,
        });
      }

      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: paymentMethod === 'RAZORPAY' ? 'RAZORPAY' : 'CASH',
          providerOrderId: rzOrder?.id || null,
          amount: money(total),
          currency: 'INR',
          paymentMode: paymentMethod,
          status: paymentMethod === 'CASH' ? 'SUCCESS' : 'PENDING',
        },
      });

      return { order };
    });

    if (paymentMethod === 'RAZORPAY') {
      return res.status(201).json({
        order: result.order,
        razorpay: {
          keyId: process.env.RAZORPAY_KEY_ID,
          orderId: rzOrder.id,
          amount: rzOrder.amount,
          currency: rzOrder.currency,
        },
      });
    }

    res.status(201).json({ order: result.order });
  })
);

// ---- Confirm a Razorpay payment from the client after checkout success. ----
router.post(
  '/payment/verify',
  validate({
    body: z.object({
      orderId: z.string().uuid(),
      razorpayOrderId: z.string(),
      razorpayPaymentId: z.string(),
      razorpaySignature: z.string(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    const valid = rz.verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });

    if (!valid) {
      // Roll back stock — release what we held — and mark failed.
      await releaseOrderStock(orderId, 'Payment signature invalid');
      throw new ApiError(400, 'Payment verification failed');
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'SUCCESS', orderStatus: 'COMPLETED' },
      }),
      prisma.payment.updateMany({
        where: { orderId },
        data: { status: 'SUCCESS', providerPaymentId: razorpayPaymentId },
      }),
    ]);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    res.json({ order });
  })
);

// Release held stock for a failed/cancelled order (RETURN action).
async function releaseOrderStock(orderId, note) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  // Only release for orders still pending — never re-credit a SUCCESS or
  // already-FAILED order (would double-add stock on retry).
  if (!order || order.paymentStatus !== 'PENDING') return;
  await prisma.$transaction(async (tx) => {
    for (const it of order.items) {
      if (!it.productId) continue;
      await adjustStock(tx, {
        storeId: order.storeId,
        productId: it.productId,
        action: 'RETURN',
        quantityChange: it.quantity,
        note: note || `Release ${order.orderNumber}`,
      });
    }
    await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'FAILED', orderStatus: 'CANCELLED' },
    });
    await tx.payment.updateMany({ where: { orderId }, data: { status: 'FAILED' } });
  });
}

// ---- Public order receipt lookup ----
router.get(
  '/order/:orderNumber',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { orderNumber: req.params.orderNumber },
      include: { items: true, store: { select: { storeName: true } } },
    });
    if (!order) throw new ApiError(404, 'Order not found');
    res.json({ order });
  })
);

module.exports = router;
module.exports.releaseOrderStock = releaseOrderStock;
