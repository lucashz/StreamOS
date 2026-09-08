ALTER TABLE "SongRequest" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'MOCK';
ALTER TABLE "SongRequest" ADD COLUMN "artworkUrl" TEXT;
ALTER TABLE "SongRequest" ADD COLUMN "playbackUrl" TEXT;
ALTER TABLE "SongRequest" ADD COLUMN "playbackRestrictions" JSONB NOT NULL DEFAULT '{}';
