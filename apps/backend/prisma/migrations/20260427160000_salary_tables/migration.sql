-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SalaryPaymentType" AS ENUM ('BASE', 'DEAL_BONUS', 'ADVANCE', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- EmployeeSalaryConfig
CREATE TABLE IF NOT EXISTS "EmployeeSalaryConfig" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "baseAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "currency"   TEXT NOT NULL DEFAULT 'USD',
  "payDay"     INTEGER NOT NULL DEFAULT 1,
  "note"       TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeSalaryConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeSalaryConfig_userId_key" ON "EmployeeSalaryConfig"("userId");

ALTER TABLE "EmployeeSalaryConfig"
  DROP CONSTRAINT IF EXISTS "EmployeeSalaryConfig_userId_fkey";
ALTER TABLE "EmployeeSalaryConfig"
  ADD CONSTRAINT "EmployeeSalaryConfig_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SalaryPayment
CREATE TABLE IF NOT EXISTS "SalaryPayment" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "amount"         DECIMAL(18,2) NOT NULL,
  "currency"       TEXT NOT NULL DEFAULT 'USD',
  "period"         TEXT NOT NULL,
  "type"           "SalaryPaymentType" NOT NULL DEFAULT 'MANUAL',
  "note"           TEXT,
  "isPaid"         BOOLEAN NOT NULL DEFAULT false,
  "paidAt"         TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalaryPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SalaryPayment_userId_idx" ON "SalaryPayment"("userId");
CREATE INDEX IF NOT EXISTS "SalaryPayment_organizationId_idx" ON "SalaryPayment"("organizationId");
CREATE INDEX IF NOT EXISTS "SalaryPayment_period_idx" ON "SalaryPayment"("period");

ALTER TABLE "SalaryPayment"
  DROP CONSTRAINT IF EXISTS "SalaryPayment_userId_fkey";
ALTER TABLE "SalaryPayment"
  ADD CONSTRAINT "SalaryPayment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalaryPayment"
  DROP CONSTRAINT IF EXISTS "SalaryPayment_organizationId_fkey";
ALTER TABLE "SalaryPayment"
  ADD CONSTRAINT "SalaryPayment_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
