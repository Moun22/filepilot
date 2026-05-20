import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import archiver from 'archiver';
import { createWriteStream, createReadStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';

const EXPORTS_DIR = join(process.cwd(), 'exports');
if (!existsSync(EXPORTS_DIR)) mkdirSync(EXPORTS_DIR, { recursive: true });

@Injectable()
export class ExportsService {
  constructor(private prisma: PrismaService) {}

  async generateZip(dossierId: string, user: { id: string; role: string }) {
    const dossier = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      include: {
        documents: true,
        checklistItems: { orderBy: { createdAt: 'asc' } },
        procedureType: { include: { organization: true } },
      },
    });

    if (!dossier) throw new NotFoundException('Dossier not found');
    if (user.role !== 'admin' && dossier.ownerUserId !== user.id) {
      throw new ForbiddenException('Not the dossier owner');
    }
    if (dossier.documents.length === 0)
      throw new BadRequestException('No files to export');

    const filename = `filepilot-${dossier.procedureType.slug}-${Date.now()}.zip`;
    const outputPath = join(EXPORTS_DIR, filename);

    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);

      // Add documents
      for (const doc of dossier.documents) {
        if (existsSync(doc.storagePath)) {
          archive.file(doc.storagePath, { name: doc.filename });
        }
      }

      // Add checklist as txt
      const checklistLines = [
        `Dossier: ${dossier.title ?? dossier.procedureType.name}`,
        `Organisation: ${dossier.procedureType.organization.name}`,
        `Démarche: ${dossier.procedureType.name}`,
        `Exporté le: ${new Date().toLocaleDateString('fr-FR')}`,
        '',
        '--- CHECKLIST ---',
        ...dossier.checklistItems.map(
          (c) =>
            `[${c.status === 'ok' ? 'x' : c.status === 'na' ? '-' : ' '}] ${c.label}${c.required ? ' *' : ''}`,
        ),
        '',
        '* = obligatoire',
      ];
      archive.append(checklistLines.join('\n'), { name: 'checklist.txt' });

      void archive.finalize();
    });

    await this.prisma.export.create({
      data: {
        dossierId,
        ownerUserId: dossier.ownerUserId,
        type: 'zip',
        storagePath: outputPath,
      },
    });

    return { stream: createReadStream(outputPath) as Readable, filename };
  }

  async listByDossier(dossierId: string, user: { id: string; role: string }) {
    const dossier = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      select: { id: true, ownerUserId: true },
    });
    if (!dossier) throw new NotFoundException('Dossier not found');
    if (user.role !== 'admin' && dossier.ownerUserId !== user.id) {
      throw new ForbiddenException('Not the dossier owner');
    }
    return this.prisma.export.findMany({
      where: { dossierId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
