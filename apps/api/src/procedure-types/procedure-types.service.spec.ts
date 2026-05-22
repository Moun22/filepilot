import { Test, TestingModule } from '@nestjs/testing';
import { ProcedureTypesService } from './procedure-types.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProcedureTypesService', () => {
  let service: ProcedureTypesService;
  let prisma: { organization: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { organization: { findMany: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcedureTypesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<ProcedureTypesService>(ProcedureTypesService);
  });

  it('queries organizations with active templates, ordered by name', async () => {
    const rows = [
      {
        id: 'o1',
        name: 'CAF',
        procedureTypes: [{ id: 'pt1', templates: [{ version: 2 }] }],
      },
    ];
    prisma.organization.findMany.mockResolvedValue(rows);

    const result = await service.findAll();

    expect(prisma.organization.findMany).toHaveBeenCalledWith({
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
    expect(result).toBe(rows);
  });
});
