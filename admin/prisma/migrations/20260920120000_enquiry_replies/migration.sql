
-- AlterEnum
ALTER TYPE "EnquiryStatus" ADD VALUE 'REPLIED';

-- AlterTable
ALTER TABLE "email_outbox" ADD COLUMN     "replyTo" TEXT;

-- CreateTable
CREATE TABLE "enquiry_replies" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentById" TEXT,
    "outboxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquiry_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enquiry_replies_outboxId_key" ON "enquiry_replies"("outboxId");

-- CreateIndex
CREATE INDEX "enquiry_replies_enquiryId_createdAt_idx" ON "enquiry_replies"("enquiryId", "createdAt");

-- AddForeignKey
ALTER TABLE "enquiry_replies" ADD CONSTRAINT "enquiry_replies_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "contact_enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_replies" ADD CONSTRAINT "enquiry_replies_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_replies" ADD CONSTRAINT "enquiry_replies_outboxId_fkey" FOREIGN KEY ("outboxId") REFERENCES "email_outbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

