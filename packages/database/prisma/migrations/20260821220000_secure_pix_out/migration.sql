ALTER TABLE "WalletSettings" ADD COLUMN "pixKeyCiphertext" TEXT;
ALTER TABLE "Payout" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'mock';
ALTER TABLE "Payout" ADD COLUMN "providerReference" TEXT;
CREATE UNIQUE INDEX "Payout_providerReference_key" ON "Payout"("providerReference");
