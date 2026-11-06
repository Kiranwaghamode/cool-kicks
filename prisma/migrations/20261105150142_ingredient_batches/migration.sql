-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "batchId" TEXT;

-- CreateTable
CREATE TABLE "IngredientBatch" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantityReceived" DECIMAL(12,3) NOT NULL,
    "quantityRemaining" DECIMAL(12,3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IngredientBatch_ingredientId_expiresAt_idx" ON "IngredientBatch"("ingredientId", "expiresAt");

-- CreateIndex
CREATE INDEX "IngredientBatch_expiresAt_idx" ON "IngredientBatch"("expiresAt");

-- CreateIndex
CREATE INDEX "StockMovement_batchId_idx" ON "StockMovement"("batchId");

-- AddForeignKey
ALTER TABLE "IngredientBatch" ADD CONSTRAINT "IngredientBatch_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientBatch" ADD CONSTRAINT "IngredientBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IngredientBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data: existing stock becomes one batch per ingredient without an expiry date.
-- Batch stock can't be negative, so earlier negative totals start again from zero.
UPDATE "Ingredient" SET "currentStock" = 0 WHERE "currentStock" < 0;

INSERT INTO "IngredientBatch" ("id", "ingredientId", "quantityReceived", "quantityRemaining", "expiresAt", "note", "receivedAt")
SELECT 'mig_' || "id", "id", "currentStock", "currentStock", NULL, 'Stock before expiry tracking', CURRENT_TIMESTAMP
FROM "Ingredient"
WHERE "currentStock" > 0;
