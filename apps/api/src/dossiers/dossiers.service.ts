import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { existsSync, unlinkSync } from 'fs';

type ChecklistItem = { key: string; label: string; required: boolean };

@Injectable()
export class DossiersService {
  constructor(private prisma: PrismaService) {}

  private async assertAccess(
    dossierId: string,
    user: { id: string; role: string },
  ) {
    const dossier = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      select: { id: true, ownerUserId: true },
    });
    if (!dossier) throw new NotFoundException('Dossier not found');
    if (user.role !== 'admin' && dossier.ownerUserId !== user.id) {
      throw new ForbiddenException('Not the dossier owner');
    }
    return dossier;
  }

  async createDossier(params: {
    ownerUserId: string;
    procedureTypeId: string;
    title?: string;
  }) {
    const { ownerUserId, procedureTypeId, title } = params;

    const activeTemplate = await this.prisma.procedureTemplate.findFirst({
      where: { procedureTypeId, isActive: true },
      orderBy: { version: 'desc' },
    });

    if (!activeTemplate)
      throw new NotFoundException('No active template for this procedure type');

    const rulesJson = activeTemplate.rulesJson as Record<string, unknown>;
    const checklist = (rulesJson?.checklist ?? []) as
      | ChecklistItem[]
      | undefined;
    if (!checklist?.length)
      throw new BadRequestException('Template has no checklist');

    return this.prisma.$transaction(async (tx) => {
      const dossier = await tx.dossier.create({
        data: {
          ownerUserId,
          procedureTypeId,
          templateVersion: activeTemplate.version,
          title: title ?? null,
          status: 'draft',
        },
      });

      await tx.dossierChecklistItem.createMany({
        data: checklist.map((c) => ({
          dossierId: dossier.id,
          key: c.key,
          label: c.label,
          required: !!c.required,
          status: 'todo',
        })),
      });

      return tx.dossier.findUnique({
        where: { id: dossier.id },
        include: {
          checklistItems: true,
          procedureType: { include: { organization: true } },
        },
      });
    });
  }

  async findAllByUser(ownerUserId: string) {
    return this.prisma.dossier.findMany({
      where: { ownerUserId },
      include: {
        procedureType: { include: { organization: true } },
        checklistItems: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: { id: string; role: string }) {
    const dossier = await this.prisma.dossier.findUnique({
      where: { id },
      include: {
        procedureType: { include: { organization: true } },
        checklistItems: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!dossier) throw new NotFoundException('Dossier not found');
    if (user.role !== 'admin' && dossier.ownerUserId !== user.id) {
      throw new ForbiddenException('Not the dossier owner');
    }
    return dossier;
  }

  async updateChecklistItem(
    dossierId: string,
    key: string,
    status: string,
    user: { id: string; role: string },
  ) {
    const validStatuses = ['todo', 'ok', 'na'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(
        `Status must be one of: ${validStatuses.join(', ')}`,
      );
    }

    await this.assertAccess(dossierId, user);

    const item = await this.prisma.dossierChecklistItem.findUnique({
      where: { dossierId_key: { dossierId, key } },
    });

    if (!item) throw new NotFoundException('Checklist item not found');

    return this.prisma.dossierChecklistItem.update({
      where: { dossierId_key: { dossierId, key } },
      data: { status },
    });
  }

  async deleteDossier(dossierId: string, user: { id: string; role: string }) {
    await this.assertAccess(dossierId, user);

    const [documents, exports] = await Promise.all([
      this.prisma.document.findMany({
        where: { dossierId },
        select: { storagePath: true },
      }),
      this.prisma.export.findMany({
        where: { dossierId },
        select: { storagePath: true },
      }),
    ]);

    await this.prisma.dossier.delete({ where: { id: dossierId } });

    for (const f of [...documents, ...exports]) {
      try {
        if (existsSync(f.storagePath)) unlinkSync(f.storagePath);
      } catch {
        // best-effort cleanup; row is gone, file leftover is non-fatal
      }
    }

    return { id: dossierId, deleted: true };
  }
}
