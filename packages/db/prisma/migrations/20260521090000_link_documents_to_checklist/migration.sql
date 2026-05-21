-- AlterTable
ALTER TABLE "Document" ADD COLUMN "checklistItemId" TEXT;

-- CreateIndex
CREATE INDEX "Document_checklistItemId_idx" ON "Document"("checklistItemId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "DossierChecklistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
