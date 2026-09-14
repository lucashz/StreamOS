DROP INDEX IF EXISTS "PlaybackAttempt_organizationId_sequenceNumber_key";
CREATE INDEX "PlaybackAttempt_organizationId_sequenceNumber_idx"
  ON "PlaybackAttempt"("organizationId", "sequenceNumber");
ALTER TABLE "PlaybackAttempt" ADD COLUMN "lastEventId" UUID;
