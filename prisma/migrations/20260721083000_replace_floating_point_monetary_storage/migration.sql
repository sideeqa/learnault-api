-- Migration: Replace floating-point monetary fields with BigInt asset units and explicit asset identity metadata.

-- 1. Update "Module" table
-- Convert "reward" DOUBLE PRECISION column to "rewardAmount" BIGINT storing exact stroops (1 XLM = 10,000,000 stroops)
ALTER TABLE "Module" ADD COLUMN "assetCode" TEXT NOT NULL DEFAULT 'XLM';
ALTER TABLE "Module" ADD COLUMN "assetIssuer" TEXT;
ALTER TABLE "Module" ADD COLUMN "assetDecimals" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "Module" ADD COLUMN "network" TEXT NOT NULL DEFAULT 'testnet';

ALTER TABLE "Module" ADD COLUMN "rewardAmount" BIGINT NOT NULL DEFAULT 0;
UPDATE "Module" SET "rewardAmount" = ROUND("reward" * 10000000)::BIGINT;
ALTER TABLE "Module" DROP COLUMN "reward";

-- 2. Update "Transaction" table
-- Convert "amount" DOUBLE PRECISION column to BIGINT storing exact stroops
ALTER TABLE "Transaction" ADD COLUMN "assetCode" TEXT NOT NULL DEFAULT 'XLM';
ALTER TABLE "Transaction" ADD COLUMN "assetIssuer" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "assetDecimals" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "Transaction" ADD COLUMN "network" TEXT NOT NULL DEFAULT 'testnet';

ALTER TABLE "Transaction" ADD COLUMN "amount_temp" BIGINT;
UPDATE "Transaction" SET "amount_temp" = ROUND("amount" * 10000000)::BIGINT;
ALTER TABLE "Transaction" DROP COLUMN "amount";
ALTER TABLE "Transaction" RENAME COLUMN "amount_temp" TO "amount";
ALTER TABLE "Transaction" ALTER COLUMN "amount" SET NOT NULL;

-- 3. Update "referrals" table
-- Convert "bonusAmount" DOUBLE PRECISION column to BIGINT storing exact stroops
ALTER TABLE "referrals" ADD COLUMN "assetCode" TEXT DEFAULT 'XLM';
ALTER TABLE "referrals" ADD COLUMN "assetIssuer" TEXT;
ALTER TABLE "referrals" ADD COLUMN "assetDecimals" INTEGER DEFAULT 7;
ALTER TABLE "referrals" ADD COLUMN "network" TEXT DEFAULT 'testnet';

ALTER TABLE "referrals" ADD COLUMN "bonusAmount_temp" BIGINT;
UPDATE "referrals" SET "bonusAmount_temp" = ROUND("bonusAmount" * 10000000)::BIGINT WHERE "bonusAmount" IS NOT NULL;
ALTER TABLE "referrals" DROP COLUMN "bonusAmount";
ALTER TABLE "referrals" RENAME COLUMN "bonusAmount_temp" TO "bonusAmount";
