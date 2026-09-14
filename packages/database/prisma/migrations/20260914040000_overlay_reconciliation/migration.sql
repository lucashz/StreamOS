ALTER TABLE "OverlayChannel"
  ADD COLUMN "connectionId" TEXT,
  ADD COLUMN "synchronizedAt" TIMESTAMP(3),
  ADD COLUMN "overlayVersion" TEXT;
