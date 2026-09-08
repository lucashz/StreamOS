CREATE TABLE "VideoSession" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "pricePerSecondInCents" BIGINT NOT NULL DEFAULT 5,
  "minimumContributionInCents" BIGINT NOT NULL DEFAULT 300,
  "maximumDurationSeconds" INTEGER NOT NULL DEFAULT 300,
  "minimumViews" INTEGER NOT NULL DEFAULT 10000,
  "minimumAgeDays" INTEGER NOT NULL DEFAULT 7,
  "maximumQueueSize" INTEGER NOT NULL DEFAULT 20,
  "requireManualReview" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "VideoRequest" (
  "id" UUID NOT NULL,
  "videoSessionId" UUID NOT NULL,
  "paymentIntentId" UUID,
  "provider" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "channelTitle" TEXT NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "selectedSeconds" INTEGER NOT NULL,
  "startAtSeconds" INTEGER NOT NULL DEFAULT 0,
  "views" INTEGER NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "thumbnailUrl" TEXT,
  "embeddable" BOOLEAN NOT NULL,
  "supporterName" TEXT NOT NULL,
  "amountInCents" BIGINT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RESERVED',
  "moderationReason" TEXT,
  "reservedUntil" TIMESTAMP(3) NOT NULL,
  "position" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VideoRequest_paymentIntentId_key" ON "VideoRequest"("paymentIntentId");
CREATE INDEX "VideoSession_organizationId_status_idx" ON "VideoSession"("organizationId", "status");
CREATE INDEX "VideoRequest_videoSessionId_status_position_idx" ON "VideoRequest"("videoSessionId", "status", "position");
CREATE INDEX "VideoRequest_videoSessionId_externalId_createdAt_idx" ON "VideoRequest"("videoSessionId", "externalId", "createdAt");
ALTER TABLE "VideoSession" ADD CONSTRAINT "VideoSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VideoRequest" ADD CONSTRAINT "VideoRequest_videoSessionId_fkey" FOREIGN KEY ("videoSessionId") REFERENCES "VideoSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VideoRequest" ADD CONSTRAINT "VideoRequest_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
