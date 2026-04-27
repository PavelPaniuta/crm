-- CreateTable ExchangeRate
CREATE TABLE IF NOT EXISTS "ExchangeRate" (
  "code"      TEXT NOT NULL,
  "symbol"    TEXT NOT NULL DEFAULT '',
  "name"      TEXT NOT NULL DEFAULT '',
  "rateToUsd" DECIMAL(18,6) NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("code")
);

-- Seed default rates
INSERT INTO "ExchangeRate" ("code","symbol","name","rateToUsd") VALUES
  ('USD','$','US Dollar',1.000000),
  ('EUR','€','Euro',0.920000),
  ('UAH','₴','Ukrainian Hryvnia',41.500000),
  ('PLN','zł','Polish Zloty',4.000000),
  ('CHF','Fr','Swiss Franc',0.880000)
ON CONFLICT DO NOTHING;
