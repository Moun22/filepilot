import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DossiersService } from './dossiers.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  procedureTemplate: { findFirst: jest.Mock };
  dossier: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock };
  dossierChecklistItem: {
    createMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
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
      },
      dossierChecklistItem: {
        createMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
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
        service.updateChecklistItem('d1', 'id_doc', 'invalid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when item not found', async () => {
      prisma.dossierChecklistItem.findUnique.mockResolvedValue(null);
      await expect(
        service.updateChecklistItem('d1', 'missing', 'ok'),
      ).rejects.toThrow(NotFoundException);
    });

    it.each(['todo', 'ok', 'na'])('updates status to %s', async (status) => {
      prisma.dossierChecklistItem.findUnique.mockResolvedValue({
        id: 'c1',
        dossierId: 'd1',
        key: 'id_doc',
      });
      prisma.dossierChecklistItem.update.mockResolvedValue({
        id: 'c1',
        status,
      });

      const result = await service.updateChecklistItem('d1', 'id_doc', status);

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
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns dossier with checklist and procedure type', async () => {
      const dossier = { id: 'd1', checklistItems: [], procedureType: {} };
      prisma.dossier.findUnique.mockResolvedValue(dossier);
      const result = await service.findOne('d1');
      expect(result).toBe(dossier);
    });
  });
});
