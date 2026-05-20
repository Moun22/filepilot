import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED_ROLES = ['user', 'admin'];

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { dossiers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setUserRole(id: string, role: string, requesterId: string) {
    if (!ALLOWED_ROLES.includes(role)) {
      throw new BadRequestException(
        `Role must be one of: ${ALLOWED_ROLES.join(', ')}`,
      );
    }
    if (id === requesterId && role !== 'admin') {
      throw new BadRequestException('Admins cannot self-demote');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, role: true },
    });
  }

  listAllDossiers() {
    return this.prisma.dossier.findMany({
      include: {
        owner: { select: { id: true, email: true } },
        procedureType: {
          select: {
            id: true,
            name: true,
            organization: { select: { name: true } },
          },
        },
        _count: { select: { documents: true, checklistItems: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteUser(id: string, requesterId: string) {
    if (id === requesterId) {
      throw new BadRequestException('Admins cannot delete themselves');
    }
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { dossiers: { select: { id: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    for (const d of user.dossiers) {
      await this.prisma.dossier.delete({ where: { id: d.id } });
    }
    await this.prisma.document.deleteMany({ where: { ownerUserId: id } });
    await this.prisma.export.deleteMany({ where: { ownerUserId: id } });
    await this.prisma.user.delete({ where: { id } });
    return { id, deleted: true };
  }

  stats() {
    return this.prisma
      .$transaction([
        this.prisma.user.count(),
        this.prisma.dossier.count(),
        this.prisma.document.count(),
        this.prisma.export.count(),
      ])
      .then(([users, dossiers, documents, exports]) => ({
        users,
        dossiers,
        documents,
        exports,
      }));
  }
}
