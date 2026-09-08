ALTER TABLE "Payment"
ADD COLUMN "platformFeeInCents" BIGINT,
ADD COLUMN "providerFeeInCents" BIGINT,
ADD COLUMN "creatorNetInCents" BIGINT;

UPDATE "Payment"
SET
  "platformFeeInCents" = ("amountInCents" * 500) / 10000,
  "providerFeeInCents" = LEAST(
    500,
    GREATEST(50, ("amountInCents" * 80) / 10000)
  ),
  "creatorNetInCents" = "amountInCents"
    - (("amountInCents" * 500) / 10000)
    - LEAST(500, GREATEST(50, ("amountInCents" * 80) / 10000));

ALTER TABLE "Payment"
ALTER COLUMN "platformFeeInCents" SET NOT NULL,
ALTER COLUMN "providerFeeInCents" SET NOT NULL,
ALTER COLUMN "creatorNetInCents" SET NOT NULL;
