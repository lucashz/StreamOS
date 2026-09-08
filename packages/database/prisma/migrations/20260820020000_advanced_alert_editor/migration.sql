CREATE TABLE "AlertMediaAsset" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "sizeInBytes" INTEGER NOT NULL,
  "durationMs" INTEGER,
  "width" INTEGER,
  "height" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "AlertMediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlertVariation" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "alertConfigId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "minimumInCents" BIGINT,
  "maximumInCents" BIGINT,
  "template" TEXT NOT NULL DEFAULT 'neon-pulse',
  "accent" TEXT NOT NULL DEFAULT '#a98cff',
  "textColor" TEXT NOT NULL DEFAULT '#ffffff',
  "fontFamily" TEXT NOT NULL DEFAULT 'Inter',
  "fontSize" INTEGER NOT NULL DEFAULT 32,
  "textAlign" TEXT NOT NULL DEFAULT 'center',
  "layout" JSONB NOT NULL,
  "minimumDurationMs" INTEGER NOT NULL DEFAULT 5000,
  "maximumDurationMs" INTEGER NOT NULL DEFAULT 12000,
  "soundVolume" INTEGER NOT NULL DEFAULT 80,
  "ttsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "ttsVoice" TEXT NOT NULL DEFAULT 'pt-BR-default',
  "ttsRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "ttsVolume" INTEGER NOT NULL DEFAULT 100,
  "showSupporter" BOOLEAN NOT NULL DEFAULT true,
  "showAmount" BOOLEAN NOT NULL DEFAULT true,
  "showMessage" BOOLEAN NOT NULL DEFAULT true,
  "visualAssetId" UUID,
  "soundAssetId" UUID,
  "configVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "AlertVariation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AlertMediaAsset_organizationId_deletedAt_idx" ON "AlertMediaAsset"("organizationId", "deletedAt");
CREATE INDEX "AlertMediaAsset_organizationId_kind_idx" ON "AlertMediaAsset"("organizationId", "kind");
CREATE INDEX "AlertVariation_organizationId_enabled_priority_idx" ON "AlertVariation"("organizationId", "enabled", "priority");
CREATE INDEX "AlertVariation_alertConfigId_deletedAt_idx" ON "AlertVariation"("alertConfigId", "deletedAt");
CREATE INDEX "AlertVariation_organizationId_minimumInCents_maximumInCents_idx" ON "AlertVariation"("organizationId", "minimumInCents", "maximumInCents");

ALTER TABLE "AlertMediaAsset" ADD CONSTRAINT "AlertMediaAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AlertVariation" ADD CONSTRAINT "AlertVariation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AlertVariation" ADD CONSTRAINT "AlertVariation_alertConfigId_fkey" FOREIGN KEY ("alertConfigId") REFERENCES "AlertConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AlertVariation" ADD CONSTRAINT "AlertVariation_visualAssetId_fkey" FOREIGN KEY ("visualAssetId") REFERENCES "AlertMediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AlertVariation" ADD CONSTRAINT "AlertVariation_soundAssetId_fkey" FOREIGN KEY ("soundAssetId") REFERENCES "AlertMediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
