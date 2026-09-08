ALTER TABLE "WalletSettings"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "taxIdHash" TEXT,
  ADD COLUMN "taxIdMasked" TEXT,
  ADD COLUMN "taxIdCiphertext" TEXT,
  ADD COLUMN "financialTermsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "providerSubaccountId" TEXT,
  ADD COLUMN "providerSubaccountStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  ADD COLUMN "providerWithdrawBlocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "providerSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "WalletSettings_providerSubaccountId_key"
  ON "WalletSettings"("providerSubaccountId");
