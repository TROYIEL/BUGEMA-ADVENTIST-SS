-- CreateTable
CREATE TABLE "hero_slides" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "body" TEXT,
    "displayText" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "ctaSecondaryLabel" TEXT,
    "ctaSecondaryHref" TEXT,
    "showPhone" BOOLEAN NOT NULL DEFAULT false,
    "imageId" TEXT,
    "collageOneId" TEXT,
    "collageTwoId" TEXT,
    "collageThreeId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishFrom" TIMESTAMP(3),
    "publishUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hero_slides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hero_slides_isActive_order_idx" ON "hero_slides"("isActive", "order");

-- AddForeignKey
ALTER TABLE "hero_slides" ADD CONSTRAINT "hero_slides_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hero_slides" ADD CONSTRAINT "hero_slides_collageOneId_fkey" FOREIGN KEY ("collageOneId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hero_slides" ADD CONSTRAINT "hero_slides_collageTwoId_fkey" FOREIGN KEY ("collageTwoId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hero_slides" ADD CONSTRAINT "hero_slides_collageThreeId_fkey" FOREIGN KEY ("collageThreeId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
