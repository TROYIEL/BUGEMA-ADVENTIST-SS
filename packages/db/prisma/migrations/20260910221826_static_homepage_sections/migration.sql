/*
  Warnings:

  - You are about to drop the `page_sections` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "page_sections" DROP CONSTRAINT "page_sections_mediaId_fkey";

-- DropForeignKey
ALTER TABLE "page_sections" DROP CONSTRAINT "page_sections_pageId_fkey";

-- DropForeignKey
ALTER TABLE "page_sections" DROP CONSTRAINT "page_sections_secondaryMediaId_fkey";

-- DropTable
DROP TABLE "page_sections";

-- DropEnum
DROP TYPE "SectionType";

-- CreateTable
CREATE TABLE "home_features" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mediaId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_highlights" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "caption" TEXT,
    "mediaId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_highlights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "home_features_isVisible_order_idx" ON "home_features"("isVisible", "order");

-- CreateIndex
CREATE INDEX "home_highlights_isVisible_order_idx" ON "home_highlights"("isVisible", "order");

-- AddForeignKey
ALTER TABLE "home_features" ADD CONSTRAINT "home_features_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_highlights" ADD CONSTRAINT "home_highlights_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
