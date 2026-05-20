import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DossiersService } from './dossiers.service';
import { PrismaService } from '../prisma/prisma.service';

const owner = { id: 'u1', role: 'user' };
const stranger = { id: 'u2', role: 'user' };
const admin = { id: 'admin1', role: 'admin' };

type PrismaMock = {
  procedureTemplate: { findFirst: jest.Mock };
  dossier: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    delete: jest.Mock;
  };
  dossierChecklistItem: {
    createMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  document: { findMany: jest.Mock };
  export: { findMany: jest.Mock };
  $transaction: jest.Mock;
};

describe('DossiersService', () => {
  let service: DossiersService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = {
      procedureTemplate: { findFirst: jest.fn() },
      dossier: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      dossierChecklistItem: {
        createMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      document: { findMany: jest.fn() },
      export: { findMany: jest.fn() },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation(
      async (fn: (tx: PrismaMock) => unknown) => fn(prisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DossiersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DossiersService>(DossiersService);
  });

  describe('createDossier', () => {
    it('throws when no active template exists', async () => {
      prisma.procedureTemplate.findFirst.mockResolvedValue(null);
      await expect(
        service.createDossier({
          ownerUserId: 'u1',
          procedureTypeId: 'pt1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when template has empty checklist', async () => {
      prisma.procedureTemplate.findFirst.mockResolvedValue({
        id: 't1',
        version: 1,
        rulesJson: { checklist: [] },
      });
      await expect(
        service.createDossier({
          ownerUserId: 'u1',
          procedureTypeId: 'pt1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates dossier with checklist items from template', async () => {
      prisma.procedureTemplate.findFirst.mockResolvedValue({
        id: 't1',
        version: 2,
        rulesJson: {
          checklist: [
            { key: 'id_doc', label: 'ID', required: true },
            { key: 'photo', label: 'Photo', required: false },
          ],
        },
      });
      prisma.dossier.create.mockResolvedValue({ id: 'd1' });
      prisma.dossier.findUnique.mockResolvedValue({
        id: 'd1',
        templateVersion: 2,
      });

      const result = await service.createDossier({
        ownerUserId: 'u1',
        procedureTypeId: 'pt1',
        title: 'Mon dossier',
      });

      expect(prisma.dossier.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ownerUserId: 'u1',
          procedureTypeId: 'pt1',
          templateVersion: 2,
          title: 'Mon dossier',
          status: 'draft',
        }),
      });
      expect(prisma.dossierChecklistItem.createMany).toHaveBeenCalledWith({
        data: [
          {
            dossierId: 'd1',
            key: 'id_doc',
            label: 'ID',
            required: true,
            status: 'todo',
          },
          {
            dossierId: 'd1',
            key: 'photo',
            label: 'Photo',
            required: false,
            status: 'todo',
          },
        ],
      });
      expect(result).toEqual({ id: 'd1', templateVersion: 2 });
    });
  });

  describe('updateChecklistItem', () => {
    it('rejects invalid status', async () => {
      await expect(
        service.updateChecklistItem('d1', 'id_doc', 'invalid', owner),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects strangers', async () => {
      prisma.dossier.findUnique.mockResolvedValue({
        id: 'd1',
        ownerUserId: owner.id,
      });
      await expect(
        service.updateChecklistItem('d1', 'id_doc', 'ok', stranger),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws when item not found', async () => {
      prisma.dossier.findUnique.mockResolvedValue({
        id: 'd1',
        ownerUserId: owner.id,
      });
      prisma.dossierChecklistItem.findUnique.mockResolvedValue(null);
      await expect(
        service.updateChecklistItem('d1', 'missing', 'ok', owner),
      ).rejects.toThrow(NotFoundException);
    });

    it.each(['todo', 'ok', 'na'])('updates status to %s', async (status) => {
      prisma.dossier.findUnique.mockResolvedValue({
        id: 'd1',
        ownerUserId: owner.id,
      });
      prisma.dossierChecklistItem.findUnique.mockResolvedValue({
        id: 'c1',
        dossierId: 'd1',
        key: 'id_doc',
      });
      prisma.dossierChecklistItem.update.mockResolvedValue({
        id: 'c1',
        status,
      });

      const result = await service.updateChecklistItem(
        'd1',
        'id_doc',
        status,
        owner,
      );

      expect(prisma.dossierChecklistItem.update).toHaveBeenCalledWith({
        where: { dossierId_key: { dossierId: 'd1', key: 'id_doc' } },
        data: { status },
      });
      expect(result.status).toBe(status);
    });
  });

  describe('findOne', () => {
    it('throws when dossier not found', async () => {
      prisma.dossier.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing', owner)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects strangers', async () => {
      prisma.dossier.findUnique.mockResolvedValue({
        id: 'd1',
        ownerUserId: owner.id,
        checklistItems: [],
        procedureType: {},
      });
      await expect(service.findOne('d1', stranger)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns dossier with checklist and procedure type', async () => {
      const dossier = {
        id: 'd1',
        ownerUserId: owner.id,
        checklistItems: [],
        procedureType: {},
      };
      prisma.dossier.findUnique.mockResolvedValue(dossier);
      const result = await service.findOne('d1', owner);
      expect(result).toBe(dossier);
    });

    it('admin can read any dossier', async () => {
      const dossier = {
        id: 'd1',
        ownerUserId: owner.id,
        checklistItems: [],
        procedureType: {},
      };
      prisma.dossier.findUnique.mockResolvedValue(dossier);
      await expect(service.findOne('d1', admin)).resolves.toBe(dossier);
    });
  });

  describe('deleteDossier', () => {
    it('rejects strangers', async () => {
      prisma.dossier.findUnique.mockResolvedValue({
        id: 'd1',
        ownerUserId: owner.id,
      });
      await expect(service.deleteDossier('d1', stranger)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deletes the dossier and reports success', async () => {
      prisma.dossier.findUnique.mockResolvedValue({
        id: 'd1',
        ownerUserId: owner.id,
      });
      prisma.document.findMany.mockResolvedValue([]);
      prisma.export.findMany.mockResolvedValue([]);
      prisma.dossier.delete.mockResolvedValue({ id: 'd1' });

      const result = await service.deleteDossier('d1', owner);

      expect(prisma.dossier.delete).toHaveBeenCalledWith({
        where: { id: 'd1' },
      });
      expect(result).toEqual({ id: 'd1', deleted: true });
    });

    it('admin can delete any dossier', async () => {
      prisma.dossier.findUnique.mockResolvedValue({
        id: 'd1',
        ownerUserId: owner.id,
      });
      prisma.document.findMany.mockResolvedValue([]);
      prisma.export.findMany.mockResolvedValue([]);
      prisma.dossier.delete.mockResolvedValue({ id: 'd1' });

      const result = await service.deleteDossier('d1', admin);
      expect(result.deleted).toBe(true);
    });
  });
});
