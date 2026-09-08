ALTER TABLE "SongRequest"
ADD COLUMN "amountInCents" BIGINT NOT NULL DEFAULT 500;

UPDATE "SongRequest" AS request
SET "amountInCents" = session."minimumContributionInCents"
FROM "SongSession" AS session
WHERE request."songSessionId" = session."id";
