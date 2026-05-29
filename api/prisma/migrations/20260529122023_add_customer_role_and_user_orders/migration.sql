-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CUSTOMER';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "placed_by_user_id" UUID;

-- CreateIndex
CREATE INDEX "orders_placed_by_user_id_idx" ON "orders"("placed_by_user_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_placed_by_user_id_fkey" FOREIGN KEY ("placed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
