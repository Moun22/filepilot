import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { unlinkSync, existsSync } from 'fs';

type Caller = { id: string; role: string };

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
      filename: string;
      mimeType: string;
      sizeBytes: number;
      storagePath: string;
    },
    user: Caller,
  ) {
    await this.assertDossierAccess(params.dossierId, user);
    return this.prisma.document.create({
      data: { ...params, ownerUserId: user.id },
    });
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

  async deleteDocument(id: string, user: Caller) {
    const doc = await this.findOne(id, user);
    if (existsSync(doc.storagePath)) {
      try {
        unlinkSync(doc.storagePath);
      } catch {
        // best-effort, see service.spec
      }
    }
    return this.prisma.document.delete({ where: { id } });
  }
}
