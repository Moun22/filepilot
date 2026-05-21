import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { unlinkSync, existsSync } from 'fs';

type Caller = { id: string; role: string };

export const MAX_DOCS_PER_CHECKLIST_ITEM = 5;

@Injectable()
export class FilesService {
  constructor(private prisma: PrismaService) {}

  private async assertDossierAccess(dossierId: string, user: Caller) {
    const dossier = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      select: { id: true, ownerUserId: true },
    });
    if (!dossier) throw new NotFoundException('Dossier not found');
    if (user.role !== 'admin' && dossier.ownerUserId !== user.id) {
      throw new ForbiddenException('Not the dossier owner');
    }
  }

  async createDocument(
    params: {
      dossierId: string;
      checklistItemId?: string | null;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      storagePath: string;
    },
    user: Caller,
  ) {
    await this.assertDossierAccess(params.dossierId, user);

    if (params.checklistItemId) {
      const item = await this.prisma.dossierChecklistItem.findUnique({
        where: { id: params.checklistItemId },
        include: { documents: { select: { id: true } } },
      });
      if (!item || item.dossierId !== params.dossierId) {
        throw new BadRequestException(
          'Checklist item does not belong to this dossier',
        );
      }
      if (item.documents.length >= MAX_DOCS_PER_CHECKLIST_ITEM) {
        throw new BadRequestException(
          `Maximum ${MAX_DOCS_PER_CHECKLIST_ITEM} documents per checklist item`,
        );
      }
    }

    const doc = await this.prisma.document.create({
      data: {
        dossierId: params.dossierId,
        ownerUserId: user.id,
        checklistItemId: params.checklistItemId ?? null,
        filename: params.filename,
        mimeType: params.mimeType,
        sizeBytes: params.sizeBytes,
        storagePath: params.storagePath,
      },
    });

    if (params.checklistItemId) {
      await this.prisma.dossierChecklistItem.update({
        where: { id: params.checklistItemId },
        data: { status: 'ok' },
      });
    }

    return doc;
  }

  async listByDossier(dossierId: string, user: Caller) {
    await this.assertDossierAccess(dossierId, user);
    return this.prisma.document.findMany({
      where: { dossierId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: Caller) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    if (user.role !== 'admin' && doc.ownerUserId !== user.id) {
      throw new ForbiddenException('Not the document owner');
    }
    return doc;
  }

  async replaceDocument(
    id: string,
    file: {
      filename: string;
      mimeType: string;
      sizeBytes: number;
      storagePath: string;
    },
    user: Caller,
  ) {
    const previous = await this.findOne(id, user);
    if (existsSync(previous.storagePath)) {
      try {
        unlinkSync(previous.storagePath);
      } catch {
        // physical cleanup is best-effort
      }
    }
    return this.prisma.document.update({
      where: { id },
      data: {
        filename: file.filename,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        storagePath: file.storagePath,
      },
    });
  }

  async deleteDocument(id: string, user: Caller) {
    const doc = await this.findOne(id, user);
    if (existsSync(doc.storagePath)) {
      try {
        unlinkSync(doc.storagePath);
      } catch {
        // best-effort
      }
    }
    const result = await this.prisma.document.delete({ where: { id } });

    if (doc.checklistItemId) {
      const remaining = await this.prisma.document.count({
        where: { checklistItemId: doc.checklistItemId },
      });
      if (remaining === 0) {
        await this.prisma.dossierChecklistItem.update({
          where: { id: doc.checklistItemId },
          data: { status: 'todo' },
        });
      }
    }

    return result;
  }
}
