ALTER TABLE "LiveQueueState"
ADD COLUMN "masterVolume" INTEGER NOT NULL DEFAULT 100;

ALTER TABLE "LiveQueueState"
ADD CONSTRAINT "LiveQueueState_masterVolume_check"
CHECK ("masterVolume" >= 0 AND "masterVolume" <= 100);
