# Migration Rollback Notes

## Migration Name

`20260721083000_replace_floating_point_monetary_storage`

## Target

Restoring binary floating point columns (`DOUBLE PRECISION`) for `Module.reward`, `Transaction.amount`, and `referrals.bonusAmount`, and removing asset identity metadata columns (`assetCode`, `assetIssuer`, `assetDecimals`, `network`).

## Manual Rollback Procedure & SQL Script

If a rollback is required, execute the following SQL script against the database:

```sql
-- Rollback 1: Restore "Module" table
ALTER TABLE "Module" ADD COLUMN "reward" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
UPDATE "Module" SET "reward" = "rewardAmount"::DOUBLE PRECISION / 10000000.0;
ALTER TABLE "Module" DROP COLUMN "rewardAmount";
ALTER TABLE "Module" DROP COLUMN "assetCode";
ALTER TABLE "Module" DROP COLUMN "assetIssuer";
ALTER TABLE "Module" DROP COLUMN "assetDecimals";
ALTER TABLE "Module" DROP COLUMN "network";

-- Rollback 2: Restore "Transaction" table
ALTER TABLE "Transaction" ADD COLUMN "amount_float" DOUBLE PRECISION;
UPDATE "Transaction" SET "amount_float" = "amount"::DOUBLE PRECISION / 10000000.0;
ALTER TABLE "Transaction" DROP COLUMN "amount";
ALTER TABLE "Transaction" RENAME COLUMN "amount_float" TO "amount";
ALTER TABLE "Transaction" ALTER COLUMN "amount" SET NOT NULL;
ALTER TABLE "Transaction" DROP COLUMN "assetCode";
ALTER TABLE "Transaction" DROP COLUMN "assetIssuer";
ALTER TABLE "Transaction" DROP COLUMN "assetDecimals";
ALTER TABLE "Transaction" DROP COLUMN "network";

-- Rollback 3: Restore "referrals" table
ALTER TABLE "referrals" ADD COLUMN "bonusAmount_float" DOUBLE PRECISION;
UPDATE "referrals" SET "bonusAmount_float" = "bonusAmount"::DOUBLE PRECISION / 10000000.0 WHERE "bonusAmount" IS NOT NULL;
ALTER TABLE "referrals" DROP COLUMN "bonusAmount";
ALTER TABLE "referrals" RENAME COLUMN "bonusAmount_float" TO "bonusAmount";
ALTER TABLE "referrals" DROP COLUMN "assetCode";
ALTER TABLE "referrals" DROP COLUMN "assetIssuer";
ALTER TABLE "referrals" DROP COLUMN "assetDecimals";
ALTER TABLE "referrals" DROP COLUMN "network";
```

## Validation Instructions

After running the rollback SQL script:

1. Re-generate Prisma Client matching the previous `schema.prisma`.
2. Verify all existing amounts divide cleanly by 10,000,000 without loss of integrity.
