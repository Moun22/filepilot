-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';

-- CreateIndex
CREATE INDEX "Dossier_ownerUserId_idx" ON "Dossier"("ownerUserId");

-- CreateIndex
CREATE INDEX "Document_dossierId_idx" ON "Document"("dossierId");

-- CreateIndex
CREATE INDEX "Export_dossierId_idx" ON "Export"("dossierId");

-- DropForeignKey on cascade-targets, then recreate with ON DELETE CASCADE
ALTER TABLE "DossierChecklistItem" DROP CONSTRAINT "DossierChecklistItem_dossierId_fkey";
ALTER TABLE "DossierChecklistItem" ADD CONSTRAINT "DossierChecklistItem_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Document" DROP CONSTRAINT "Document_dossierId_fkey";
ALTER TABLE "Document" ADD CONSTRAINT "Document_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Export" DROP CONSTRAINT "Export_dossierId_fkey";
ALTER TABLE "Export" ADD CONSTRAINT "Export_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
