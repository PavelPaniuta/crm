-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseSupplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "ExpenseSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseFile" (
    "id" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expenseId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,

    CONSTRAINT "ExpenseFile_pkey" PRIMARY KEY ("id")
);

-- Default categories per organization (before expense FK)
INSERT INTO "ExpenseCategory" ("id", "name", "color", "sortOrder", "isActive", "createdAt", "updatedAt", "organizationId")
SELECT
    'ecat_' || substr(md5(o."id" || ':tel'), 1, 20),
    'Телефония',
    '#6366F1',
    0,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    o."id"
FROM "Organization" o
UNION ALL
SELECT
    'ecat_' || substr(md5(o."id" || ':office'), 1, 20),
    'Офис',
    '#059669',
    1,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    o."id"
FROM "Organization" o
UNION ALL
SELECT
    'ecat_' || substr(md5(o."id" || ':svc'), 1, 20),
    'Сервисы',
    '#8B5CF6',
    2,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    o."id"
FROM "Organization" o
UNION ALL
SELECT
    'ecat_' || substr(md5(o."id" || ':other'), 1, 20),
    'Другое',
    '#64748B',
    3,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    o."id"
FROM "Organization" o;

-- AlterTable Expense: add columns with backfill to «Другое»
ALTER TABLE "Expense" ADD COLUMN "comment" TEXT;
ALTER TABLE "Expense" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "supplierId" TEXT;

UPDATE "Expense" e
SET "categoryId" = c."id"
FROM "ExpenseCategory" c
WHERE c."organizationId" = e."organizationId" AND c."name" = 'Другое';

ALTER TABLE "Expense" ALTER COLUMN "categoryId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_organizationId_name_key" ON "ExpenseCategory"("organizationId", "name");
CREATE INDEX "ExpenseCategory_organizationId_idx" ON "ExpenseCategory"("organizationId");

CREATE UNIQUE INDEX "ExpenseSupplier_categoryId_name_key" ON "ExpenseSupplier"("categoryId", "name");
CREATE INDEX "ExpenseSupplier_categoryId_idx" ON "ExpenseSupplier"("categoryId");

CREATE INDEX "ExpenseFile_expenseId_idx" ON "ExpenseFile"("expenseId");
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExpenseSupplier" ADD CONSTRAINT "ExpenseSupplier_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExpenseFile" ADD CONSTRAINT "ExpenseFile_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseFile" ADD CONSTRAINT "ExpenseFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "ExpenseSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
