CREATE TABLE "LiveSession" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LiveSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "LiveQueueItem" ADD COLUMN "liveSessionId" UUID;
ALTER TABLE "LiveQueueItem" ADD CONSTRAINT "LiveQueueItem_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "LiveSession_organizationId_status_startedAt_idx" ON "LiveSession"("organizationId", "status", "startedAt");
CREATE INDEX "LiveQueueItem_liveSessionId_createdAt_idx" ON "LiveQueueItem"("liveSessionId", "createdAt");
CREATE UNIQUE INDEX "LiveSession_one_active_per_organization" ON "LiveSession"("organizationId") WHERE "status" = 'ACTIVE';
