-- CreateTable
CREATE TABLE "master_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_products" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "description" TEXT,
    "image_url" TEXT,
    "unit" TEXT,
    "reference_price" DECIMAL(10,2),
    "mrp" DECIMAL(10,2),
    "variations" JSONB,
    "source_platform" TEXT,
    "source_url" TEXT,
    "external_id" TEXT NOT NULL,
    "last_fetched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_categories_name_key" ON "master_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "master_categories_slug_key" ON "master_categories"("slug");

-- CreateIndex
CREATE INDEX "master_products_category_id_idx" ON "master_products"("category_id");

-- CreateIndex
CREATE INDEX "master_products_name_idx" ON "master_products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "master_products_source_platform_external_id_key" ON "master_products"("source_platform", "external_id");

-- AddForeignKey
ALTER TABLE "master_products" ADD CONSTRAINT "master_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "master_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
