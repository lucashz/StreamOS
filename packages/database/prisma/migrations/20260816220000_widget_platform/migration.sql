CREATE TABLE "Widget" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB NOT NULL,
  "configVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Widget_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OverlayChannel" ADD COLUMN "widgetId" UUID;
CREATE UNIQUE INDEX "OverlayChannel_widgetId_key" ON "OverlayChannel"("widgetId");
CREATE INDEX "Widget_organizationId_deletedAt_idx" ON "Widget"("organizationId", "deletedAt");
CREATE INDEX "Widget_organizationId_type_idx" ON "Widget"("organizationId", "type");
ALTER TABLE "Widget" ADD CONSTRAINT "Widget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OverlayChannel" ADD CONSTRAINT "OverlayChannel_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "Widget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
