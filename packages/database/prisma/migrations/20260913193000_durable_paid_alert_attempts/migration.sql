ALTER TYPE "LiveQueueStatus" ADD VALUE IF NOT EXISTS 'NEEDS_REVIEW';

CREATE TYPE "PlaybackAttemptStatus" AS ENUM (
  'CREATED',
  'DISPATCHED',
  'RECEIVED',
  'STARTED',
  'COMPLETED',
  'FAILED',
  'NEEDS_REVIEW'
);

ALTER TABLE "Organization"
  ADD COLUMN "nextLiveQueueSequence" BIGINT NOT NULL DEFAULT 1;

ALTER TABLE "LiveQueueItem"
  ADD COLUMN "paymentId" UUID,
  ADD COLUMN "sequenceNumber" BIGINT;

WITH numbered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "organizationId"
      ORDER BY "createdAt", "position", "id"
    ) AS sequence_number
  FROM "LiveQueueItem"
)
UPDATE "LiveQueueItem" AS item
SET "sequenceNumber" = numbered.sequence_number
FROM numbered
WHERE item."id" = numbered."id";

UPDATE "Organization" AS organization
SET "nextLiveQueueSequence" = COALESCE(queue.maximum_sequence, 0) + 1
FROM (
  SELECT "organizationId", MAX("sequenceNumber") AS maximum_sequence
  FROM "LiveQueueItem"
  GROUP BY "organizationId"
) AS queue
WHERE organization."id" = queue."organizationId";

UPDATE "LiveQueueItem"
SET "paymentId" = "sourceId"::uuid
WHERE "sourceType" = 'payment.confirmed.v1'
  AND "sourceId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM "Payment" WHERE "Payment"."id" = "LiveQueueItem"."sourceId"::uuid
  );

ALTER TABLE "LiveQueueItem"
  ALTER COLUMN "sequenceNumber" SET NOT NULL;

CREATE TABLE "PlaybackAttempt" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "queueItemId" UUID NOT NULL,
  "sequenceNumber" BIGINT NOT NULL,
  "status" "PlaybackAttemptStatus" NOT NULL DEFAULT 'CREATED',
  "attemptNumber" INTEGER NOT NULL,
  "connectionId" TEXT,
  "dispatchedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlaybackAttempt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OverlayDelivery" ADD COLUMN "playbackAttemptId" UUID;
ALTER TABLE "OverlayPlaybackReceipt"
  ADD COLUMN "playbackAttemptId" UUID,
  ADD COLUMN "connectionId" TEXT,
  ADD COLUMN "sequenceNumber" BIGINT;

CREATE UNIQUE INDEX "LiveQueueItem_organizationId_sequenceNumber_key"
  ON "LiveQueueItem"("organizationId", "sequenceNumber");
CREATE INDEX "LiveQueueItem_paymentId_idx" ON "LiveQueueItem"("paymentId");
CREATE UNIQUE INDEX "PlaybackAttempt_queueItemId_attemptNumber_key"
  ON "PlaybackAttempt"("queueItemId", "attemptNumber");
CREATE UNIQUE INDEX "PlaybackAttempt_organizationId_sequenceNumber_key"
  ON "PlaybackAttempt"("organizationId", "sequenceNumber");
CREATE INDEX "PlaybackAttempt_organizationId_status_nextAttemptAt_idx"
  ON "PlaybackAttempt"("organizationId", "status", "nextAttemptAt");
CREATE INDEX "PlaybackAttempt_queueItemId_createdAt_idx"
  ON "PlaybackAttempt"("queueItemId", "createdAt");
CREATE INDEX "OverlayDelivery_playbackAttemptId_idx"
  ON "OverlayDelivery"("playbackAttemptId");
CREATE INDEX "OverlayPlaybackReceipt_playbackAttemptId_idx"
  ON "OverlayPlaybackReceipt"("playbackAttemptId");

ALTER TABLE "LiveQueueItem"
  ADD CONSTRAINT "LiveQueueItem_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlaybackAttempt"
  ADD CONSTRAINT "PlaybackAttempt_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlaybackAttempt"
  ADD CONSTRAINT "PlaybackAttempt_queueItemId_fkey"
  FOREIGN KEY ("queueItemId") REFERENCES "LiveQueueItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OverlayDelivery"
  ADD CONSTRAINT "OverlayDelivery_playbackAttemptId_fkey"
  FOREIGN KEY ("playbackAttemptId") REFERENCES "PlaybackAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OverlayPlaybackReceipt"
  ADD CONSTRAINT "OverlayPlaybackReceipt_playbackAttemptId_fkey"
  FOREIGN KEY ("playbackAttemptId") REFERENCES "PlaybackAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
