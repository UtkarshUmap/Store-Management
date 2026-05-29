const router = require('express').Router();
const prisma = require('../lib/prisma');
const { asyncHandler } = require('../lib/utils');
const { authenticate } = require('../middleware/auth');

// All routes here require a valid token. Used by the customer-facing
// "My orders" page; works for any authenticated user (a STORE_OWNER who
// also places orders sees their personal orders here too).

router.get(
  '/orders',
  authenticate,
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { placedByUserId: req.user.id },
      include: {
        items: true,
        store: { select: { storeName: true, storeSlug: true, city: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ orders });
  })
);

module.exports = router;
