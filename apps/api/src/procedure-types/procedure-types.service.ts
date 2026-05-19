import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProcedureTypesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const organizations = await this.prisma.organization.findMany({
      include: {
        procedureTypes: {
          include: {
            templates: {
              where: { isActive: true },
              orderBy: { version: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return organizations;
  }
}
