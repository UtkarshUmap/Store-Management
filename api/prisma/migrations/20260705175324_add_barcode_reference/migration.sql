-- CreateTable
CREATE TABLE "BarcodeReference" (
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT,
    "imageUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'openfoodfacts',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarcodeReference_pkey" PRIMARY KEY ("barcode")
);

-- CreateIndex
CREATE INDEX "BarcodeReference_name_idx" ON "BarcodeReference"("name");
