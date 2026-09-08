CREATE TABLE "WalletSettings" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "pixKeyType" TEXT,
  "pixKeyHash" TEXT,
  "pixKeyMasked" TEXT,
  "pixKeyVerifiedAt" TIMESTAMP(3),
  "minimumPayoutInCents" BIGINT NOT NULL DEFAULT 1000,
  "dailyPayoutLimitInCents" BIGINT NOT NULL DEFAULT 100000,
  "monthlyPayoutLimitInCents" BIGINT NOT NULL DEFAULT 1000000,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WalletSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletSettings_organizationId_key" ON "WalletSettings"("organizationId");
ALTER TABLE "WalletSettings" ADD CONSTRAINT "WalletSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payout"
ADD COLUMN "destinationMasked" TEXT,
ADD COLUMN "failureReason" TEXT;
