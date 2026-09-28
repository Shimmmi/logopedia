CREATE TABLE IF NOT EXISTS "ModelCatalogHide" (
  "id" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "kind" "ModelKind" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModelCatalogHide_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ModelCatalogHide_modelId_kind_key" ON "ModelCatalogHide"("modelId", "kind");
