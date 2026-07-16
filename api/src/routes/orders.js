const router = require('express').Router();
const prisma = require('../lib/prisma');
const { asyncHandler } = require('../lib/utils');
const { authenticate } = require('../middleware/auth');
const { requireStoreAccess } = require('../middleware/storeAccess');

// List orders for a store.
router.get(
  '/:storeId/orders',
  authenticate,
  requireStoreAccess,
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { storeId: req.store.id },
      include: {
        items: true,
        customer: true,
        // Who actually placed it (a signed-in shopper), plus the payment rows —
        // without these the owner can't tell who an order belongs to or how it
        // was settled.
        placedBy: { select: { id: true, fullName: true, email: true, phone: true } },
        payments: {
          select: { provider: true, status: true, providerPaymentId: true, paymentMode: true, amount: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ orders });
  })
);

// Dashboard summary: today's revenue, order count, low-stock list, top products.
router.get(
  '/:storeId/dashboard',
  authenticate,
  requireStoreAccess,
  asyncHandler(async (req, res) => {
    const storeId = req.store.id;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [todayAgg, todayCount, lowStock, totalProducts, recentOrders] = await Promise.all([
      prisma.order.aggregate({
        where: { storeId, paymentStatus: 'SUCCESS', createdAt: { gte: startOfToday } },
        _sum: { totalAmount: true },
      }),
      prisma.order.count({
        where: { storeId, paymentStatus: 'SUCCESS', createdAt: { gte: startOfToday } },
      }),
      prisma.$queryRaw`
        SELECT id, name, stock_quantity AS "stockQuantity", minimum_stock AS "minimumStock"
        FROM products
        WHERE store_id = ${storeId}::uuid AND is_active = true
          AND stock_quantity <= minimum_stock
        ORDER BY stock_quantity ASC
        LIMIT 20`,
      prisma.product.count({ where: { storeId, isActive: true } }),
      prisma.order.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { orderNumber: true, totalAmount: true, paymentStatus: true, createdAt: true },
      }),
    ]);

    // Top selling products (last 30 days) via order_items.
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const topProducts = await prisma.$queryRaw`
      SELECT oi.product_name AS "name",
             SUM(oi.quantity)::int AS "unitsSold",
             SUM(oi.total_price) AS "revenue"
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.store_id = ${storeId}::uuid
        AND o.payment_status = 'SUCCESS'
        AND o.created_at >= ${since}
      GROUP BY oi.product_name
      ORDER BY "unitsSold" DESC
      LIMIT 10`;

    res.json({
      today: {
        revenue: todayAgg._sum.totalAmount || 0,
        orders: todayCount,
      },
      totalProducts,
      lowStock,
      topProducts,
      recentOrders,
    });
  })
);

// Revenue time series for charts.
router.get(
  '/:storeId/analytics/daily',
  authenticate,
  requireStoreAccess,
  asyncHandler(async (req, res) => {
    // Up to a year. Beyond ~2 months a per-day series is unreadable (and 365
    // points is a lot to ship), so widen the bucket as the range grows.
    const days = Math.min(Math.max(Number(req.query.days) || 14, 1), 365);
    const bucket = days <= 31 ? 'day' : days <= 120 ? 'week' : 'month';
    const since = new Date();
    since.setDate(since.getDate() - days);

    // date_trunc's unit can't be a bound parameter, so it comes from the
    // whitelist above — never from user input.
    const rows = await prisma.$queryRawUnsafe(
      `SELECT to_char(date_trunc('${bucket}', created_at), 'YYYY-MM-DD') AS "date",
              COUNT(*)::int AS "orders",
              COALESCE(SUM(total_amount), 0) AS "revenue"
       FROM orders
       WHERE store_id = $1::uuid
         AND payment_status = 'SUCCESS'
         AND created_at >= $2
       GROUP BY 1 ORDER BY 1`,
      req.store.id,
      since
    );
    res.json({ series: rows, days, bucket });
  })
);

module.exports = router;
