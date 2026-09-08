ALTER TABLE "OverlayChannel"
  ADD COLUMN "connectedAt" TIMESTAMP(3),
  ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3),
  ADD COLUMN "disconnectedAt" TIMESTAMP(3);

CREATE TABLE "OverlayPlaybackReceipt" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "overlayChannelId" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "mediaReadyAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "lastSequence" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OverlayPlaybackReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OverlayPlaybackReceipt_overlayChannelId_eventId_key" ON "OverlayPlaybackReceipt"("overlayChannelId", "eventId");
CREATE INDEX "OverlayPlaybackReceipt_organizationId_updatedAt_idx" ON "OverlayPlaybackReceipt"("organizationId", "updatedAt");
CREATE INDEX "OverlayPlaybackReceipt_overlayChannelId_status_idx" ON "OverlayPlaybackReceipt"("overlayChannelId", "status");

ALTER TABLE "OverlayPlaybackReceipt" ADD CONSTRAINT "OverlayPlaybackReceipt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OverlayPlaybackReceipt" ADD CONSTRAINT "OverlayPlaybackReceipt_overlayChannelId_fkey" FOREIGN KEY ("overlayChannelId") REFERENCES "OverlayChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
