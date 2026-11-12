-- Additive Resource registry migration; preserves existing Resource records.
ALTER TABLE "Resource"
 ADD COLUMN "resourceType" TEXT NOT NULL DEFAULT 'Physical Asset',
 ADD COLUMN "condition" TEXT NOT NULL DEFAULT 'Good',
 ADD COLUMN "location" TEXT NOT NULL DEFAULT '',
 ADD COLUMN "serialNumber" TEXT,
 ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
 ADD COLUMN "warrantyEnd" TIMESTAMP(3),
 ADD COLUMN "purchaseDate" TIMESTAMP(3),
 ADD COLUMN "purchasePrice" DECIMAL(18,2),
 ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'GEL',
 ADD COLUMN "supplier" TEXT NOT NULL DEFAULT '',
 ADD COLUMN "usefulLifeMonths" INTEGER,
 ADD COLUMN "residualValue" DECIMAL(18,2),
 ADD COLUMN "customFields" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX "Resource_branchId_status_idx" ON "Resource"("branchId","status");
CREATE INDEX "Resource_category_idx" ON "Resource"("category");
CREATE INDEX "Resource_createdAt_idx" ON "Resource"("createdAt");

CREATE TABLE "ResourceCounter" (
  "name" TEXT NOT NULL,
  "nextNumber" INTEGER NOT NULL,
  CONSTRAINT "ResourceCounter_pkey" PRIMARY KEY ("name")
);
-- Use the greatest existing AST number so the next generated Asset ID is never recycled.
INSERT INTO "ResourceCounter"("name","nextNumber")
SELECT 'ASSET', GREATEST(1, COALESCE(MAX(
  CASE WHEN "assetCode" ~ '^AST-[0-9]{1,9}$'
       THEN SUBSTRING("assetCode" FROM 5)::INTEGER ELSE 0 END
), 0) + 1)
FROM "Resource";

CREATE TABLE "ResourceCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "definitions" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResourceCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ResourceCategory_name_key" ON "ResourceCategory"("name");

CREATE TABLE "ResourceDocument" (
  "id" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "content" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResourceDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ResourceDocument_resourceId_createdAt_idx" ON "ResourceDocument"("resourceId","createdAt");
ALTER TABLE "ResourceDocument" ADD CONSTRAINT "ResourceDocument_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Initial category definitions can be extended or edited by authorized central administrators.
INSERT INTO "ResourceCategory" ("id","name","active","definitions","createdAt","updatedAt") VALUES
('rcat-laptop','Laptop',true,'[{"key":"processor","label":"Processor","required":false},{"key":"ram","label":"RAM","required":false},{"key":"storage","label":"Storage","required":false}]',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('rcat-monitor','Monitor',true,'[{"key":"screenSize","label":"Screen size","required":false},{"key":"resolution","label":"Resolution","required":false}]',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('rcat-tablet','Tablet',true,'[]',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('rcat-mobile','Mobile Device',true,'[]',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('rcat-printer','Printer',true,'[]',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('rcat-network','Network',true,'[]',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('rcat-pos','POS Device',true,'[]',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('rcat-other','Other',true,'[]',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
