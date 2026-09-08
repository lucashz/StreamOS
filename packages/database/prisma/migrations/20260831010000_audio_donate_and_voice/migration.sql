ALTER TABLE "PaymentIntent"
ADD COLUMN "alertType" TEXT NOT NULL DEFAULT 'TEXT',
ADD COLUMN "audioUrl" TEXT,
ADD COLUMN "audioDurationSeconds" INTEGER,
ADD COLUMN "ttsVoice" TEXT;
