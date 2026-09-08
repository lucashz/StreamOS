CREATE TABLE "SongSession" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "theme" TEXT NOT NULL,
  "allowedGenres" TEXT[],
  "allowedArtists" TEXT[],
  "blockedArtists" TEXT[],
  "minimumContributionInCents" BIGINT NOT NULL DEFAULT 500,
  "maximumDurationSeconds" INTEGER NOT NULL DEFAULT 360,
  "maximumQueueSize" INTEGER NOT NULL DEFAULT 30,
  "maximumRequestsPerSupporter" INTEGER NOT NULL DEFAULT 3,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SongSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SongRequest" (
  "id" UUID NOT NULL,
  "songSessionId" UUID NOT NULL,
  "paymentIntentId" UUID,
  "externalId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "artist" TEXT NOT NULL,
  "genre" TEXT NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "supporterName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RESERVED',
  "reservedUntil" TIMESTAMP(3) NOT NULL,
  "position" INTEGER,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SongRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SongRequest_paymentIntentId_key" ON "SongRequest"("paymentIntentId");
CREATE INDEX "SongSession_organizationId_status_idx" ON "SongSession"("organizationId", "status");
CREATE INDEX "SongRequest_songSessionId_status_position_idx" ON "SongRequest"("songSessionId", "status", "position");
CREATE INDEX "SongRequest_songSessionId_supporterName_createdAt_idx" ON "SongRequest"("songSessionId", "supporterName", "createdAt");
ALTER TABLE "SongSession" ADD CONSTRAINT "SongSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SongRequest" ADD CONSTRAINT "SongRequest_songSessionId_fkey" FOREIGN KEY ("songSessionId") REFERENCES "SongSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SongRequest" ADD CONSTRAINT "SongRequest_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
