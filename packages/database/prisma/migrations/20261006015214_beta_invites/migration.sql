-- AlterTable
ALTER TABLE "PaymentIntent" ALTER COLUMN "expiresAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PlaybackAttempt" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VideoSession" ALTER COLUMN "allowedChannelIds" DROP DEFAULT,
ALTER COLUMN "blockedChannelIds" DROP DEFAULT,
ALTER COLUMN "blockedTitleTerms" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WebhookEndpoint" ALTER COLUMN "secretCiphertext" DROP DEFAULT;

-- CreateTable
CREATE TABLE "BetaInvite" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "acceptedById" UUID,

    CONSTRAINT "BetaInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BetaInvite_codeHash_key" ON "BetaInvite"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "BetaInvite_acceptedById_key" ON "BetaInvite"("acceptedById");

-- CreateIndex
CREATE INDEX "BetaInvite_email_idx" ON "BetaInvite"("email");

-- AddForeignKey
ALTER TABLE "BetaInvite" ADD CONSTRAINT "BetaInvite_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
