ALTER TABLE "SubscriptionRenewal"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "SubscriptionRenewal_idempotencyKey_key"
ON "SubscriptionRenewal"("idempotencyKey");
