UPDATE "VideoRequest"
SET "status" = 'APPROVED'
WHERE "status" = 'PENDING_REVIEW';

ALTER TABLE "VideoSession"
DROP COLUMN "requireManualReview",
DROP COLUMN "requireThumbnailReview";
