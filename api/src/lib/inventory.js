const { ApiError } = require('../lib/utils');

// Adjust a product's stock and write an InventoryLog row in ONE transaction.
// `tx` is a Prisma transaction client. quantityChange is signed:
//   negative for SALE/DAMAGED, positive for RESTOCK/RETURN.
// Uses a conditional UPDATE so concurrent SALEs on the same product can't
// oversell, even under Postgres's default READ COMMITTED isolation.
async function adjustStock(tx, { storeId, productId, action, quantityChange, note }) {
  const rows = await tx.$queryRaw`
    UPDATE products
    SET stock_quantity = stock_quantity + ${quantityChange}
    WHERE id = ${productId}::uuid
      AND store_id = ${storeId}::uuid
      AND stock_quantity + ${quantityChange} >= 0
    RETURNING stock_quantity`;

  if (rows.length === 0) {
    // Update was rejected — figure out why so the caller gets a useful error.
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new ApiError(404, `Product ${productId} not found`);
    if (product.storeId !== storeId) throw new ApiError(400, 'Product/store mismatch');
    throw new ApiError(
      409,
      `Insufficient stock for "${product.name}" (have ${product.stockQuantity})`
    );
  }

  const newStock = Number(rows[0].stock_quantity);
  const previousStock = newStock - quantityChange;

  await tx.inventoryLog.create({
    data: {
      storeId,
      productId,
      action,
      quantityChange,
      previousStock,
      newStock,
      note: note || null,
    },
  });

  return { previousStock, newStock };
}

module.exports = { adjustStock };
