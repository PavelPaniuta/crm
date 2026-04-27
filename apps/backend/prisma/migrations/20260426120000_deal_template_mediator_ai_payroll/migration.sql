-- AlterTable
ALTER TABLE "DealTemplate" ADD COLUMN IF NOT EXISTS "calcPreset" TEXT;
ALTER TABLE "DealTemplate" ADD COLUMN IF NOT EXISTS "payrollPoolPct" DECIMAL(5,2);
ALTER TABLE "DealTemplate" ADD COLUMN IF NOT EXISTS "calcGrossFieldKey" TEXT;
ALTER TABLE "DealTemplate" ADD COLUMN IF NOT EXISTS "calcMediatorPctKey" TEXT;
ALTER TABLE "DealTemplate" ADD COLUMN IF NOT EXISTS "calcAiPctKey" TEXT;
