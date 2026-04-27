-- AlterTable: add universal calculation chain column
ALTER TABLE "DealTemplate" ADD COLUMN IF NOT EXISTS "calcSteps" JSONB;
