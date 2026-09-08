ALTER TABLE "SongRequest" RENAME COLUMN "reservedUntil" TO "checkoutExpiresAt";
ALTER TABLE "VideoRequest" RENAME COLUMN "reservedUntil" TO "checkoutExpiresAt";
