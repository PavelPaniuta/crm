-- CreateTable
CREATE TABLE "Olx" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "defaultPct" DECIMAL(5,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Olx_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealOlx" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "olxId" TEXT NOT NULL,
    "pct" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealOlx_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationInfoPartner" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Инфо',
    "defaultPct" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationInfoPartner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Olx_organizationId_idx" ON "Olx"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "DealOlx_dealId_key" ON "DealOlx"("dealId");

-- CreateIndex
CREATE INDEX "DealOlx_olxId_idx" ON "DealOlx"("olxId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationInfoPartner_organizationId_key" ON "OrganizationInfoPartner"("organizationId");

-- AddForeignKey
ALTER TABLE "Olx" ADD CONSTRAINT "Olx_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealOlx" ADD CONSTRAINT "DealOlx_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealOlx" ADD CONSTRAINT "DealOlx_olxId_fkey" FOREIGN KEY ("olxId") REFERENCES "Olx"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInfoPartner" ADD CONSTRAINT "OrganizationInfoPartner_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
