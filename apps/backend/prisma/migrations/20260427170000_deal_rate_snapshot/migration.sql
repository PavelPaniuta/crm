-- Add rateSnapshot column to Deal table
-- Stores exchange rates at the moment of deal creation for historical accuracy
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "rateSnapshot" JSONB;
