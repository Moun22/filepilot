import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { unlinkSync, existsSync } from 'fs';

@Injectable()
export class FilesService {
  constructor(private prisma: PrismaService) {}

  async createDocument(params: {
    dossierId: string;
    ownerUserId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
  }) {
    return this.prisma.document.create({ data: params });
  }

  async listByDossier(dossierId: string) {
    return this.prisma.document.findMany({
      where: { dossierId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async deleteDocument(id: string) {
    const doc = await this.findOne(id);
    if (existsSync(doc.storagePath)) unlinkSync(doc.storagePath);
    return this.prisma.document.delete({ where: { id } });
  }
}
