const prisma = require('../lib/prisma');
const { ApiError, asyncHandler } = require('../lib/utils');

// Ensures the authenticated user actually owns (or staffs) the :storeId in the
// route, and attaches the store to req.store. SUPER_ADMIN bypasses ownership.
const requireStoreAccess = asyncHandler(async (req, _res, next) => {
  const storeId = req.params.storeId || req.body.storeId;
  if (!storeId) throw new ApiError(400, 'storeId is required');

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new ApiError(404, 'Store not found');

  if (req.user.role === 'SUPER_ADMIN' || store.ownerId === req.user.id) {
    req.store = store;
    return next();
  }

  const staff = await prisma.staff.findFirst({
    where: { storeId, userId: req.user.id },
  });
  if (!staff) throw new ApiError(403, 'You do not have access to this store');

  req.store = store;
  req.staff = staff;
  next();
});

module.exports = { requireStoreAccess };
