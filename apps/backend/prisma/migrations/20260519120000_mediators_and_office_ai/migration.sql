-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'AI_PARTNER';

-- AlterEnum
ALTER TYPE "SalaryPaymentType" ADD VALUE IF NOT EXISTS 'AI_DEAL_SHARE';

-- CreateTable
CREATE TABLE "Mediator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "defaultPct" DECIMAL(5,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mediator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealMediator" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "mediatorId" TEXT NOT NULL,
    "pct" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealMediator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationAiPartner" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'AI',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationAiPartner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mediator_organizationId_idx" ON "Mediator"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "DealMediator_dealId_key" ON "DealMediator"("dealId");

-- CreateIndex
CREATE INDEX "DealMediator_mediatorId_idx" ON "DealMediator"("mediatorId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationAiPartner_organizationId_key" ON "OrganizationAiPartner"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationAiPartner_userId_key" ON "OrganizationAiPartner"("userId");

-- AddForeignKey
ALTER TABLE "Mediator" ADD CONSTRAINT "Mediator_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealMediator" ADD CONSTRAINT "DealMediator_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealMediator" ADD CONSTRAINT "DealMediator_mediatorId_fkey" FOREIGN KEY ("mediatorId") REFERENCES "Mediator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAiPartner" ADD CONSTRAINT "OrganizationAiPartner_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAiPartner" ADD CONSTRAINT "OrganizationAiPartner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
