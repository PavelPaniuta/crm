-- AlterTable
ALTER TABLE "DealTemplate" ADD COLUMN "calcPreset" TEXT,
ADD COLUMN "payrollPoolPct" DECIMAL(5,2),
ADD COLUMN "calcGrossFieldKey" TEXT,
ADD COLUMN "calcMediatorPctKey" TEXT,
ADD COLUMN "calcAiPctKey" TEXT;
