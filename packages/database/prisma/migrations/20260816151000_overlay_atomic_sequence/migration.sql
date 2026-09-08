ALTER TABLE "OverlayChannel"
ADD COLUMN "nextSequence" BIGINT NOT NULL DEFAULT 1;

UPDATE "OverlayChannel" AS channel
SET "nextSequence" = COALESCE(
  (
    SELECT MAX(delivery."sequence") + 1
    FROM "OverlayDelivery" AS delivery
    WHERE delivery."overlayChannelId" = channel."id"
  ),
  1
);
