CREATE TYPE "LiveQueueStatus" AS ENUM (
  'PENDING', 'AWAITING_MODERATION', 'APPROVED', 'PLAYING', 'PAUSED',
  'PLAYED', 'SKIPPED', 'REJECTED', 'FAILED', 'CANCELED'
);

CREATE TABLE "LiveQueueState" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "autoAdvance" BOOLEAN NOT NULL DEFAULT true,
  "playbackTimeoutSeconds" INTEGER NOT NULL DEFAULT 120,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LiveQueueState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiveQueueItem" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "supporterName" TEXT,
  "amountInCents" BIGINT,
  "title" TEXT,
  "content" TEXT,
  "metadata" JSONB NOT NULL,
  "moderationStatus" TEXT,
  "status" "LiveQueueStatus" NOT NULL DEFAULT 'PENDING',
  "position" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "playbackDeadline" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LiveQueueItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiveQueueAction" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "queueItemId" UUID,
  "actorUserId" UUID,
  "action" TEXT NOT NULL,
  "origin" TEXT NOT NULL,
  "previousStatus" "LiveQueueStatus",
  "nextStatus" "LiveQueueStatus",
  "reason" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveQueueAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LiveQueueState_organizationId_key" ON "LiveQueueState"("organizationId");
CREATE UNIQUE INDEX "LiveQueueItem_organizationId_sourceType_sourceId_key" ON "LiveQueueItem"("organizationId", "sourceType", "sourceId");
CREATE INDEX "LiveQueueItem_organizationId_status_position_idx" ON "LiveQueueItem"("organizationId", "status", "position");
CREATE INDEX "LiveQueueItem_organizationId_createdAt_idx" ON "LiveQueueItem"("organizationId", "createdAt");
CREATE UNIQUE INDEX "LiveQueueAction_idempotencyKey_key" ON "LiveQueueAction"("idempotencyKey");
CREATE INDEX "LiveQueueAction_organizationId_createdAt_idx" ON "LiveQueueAction"("organizationId", "createdAt");
CREATE INDEX "LiveQueueAction_queueItemId_createdAt_idx" ON "LiveQueueAction"("queueItemId", "createdAt");

ALTER TABLE "LiveQueueState" ADD CONSTRAINT "LiveQueueState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LiveQueueItem" ADD CONSTRAINT "LiveQueueItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LiveQueueAction" ADD CONSTRAINT "LiveQueueAction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LiveQueueAction" ADD CONSTRAINT "LiveQueueAction_queueItemId_fkey" FOREIGN KEY ("queueItemId") REFERENCES "LiveQueueItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LiveQueueAction" ADD CONSTRAINT "LiveQueueAction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
