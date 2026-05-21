import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FilesService, MAX_DOCS_PER_CHECKLIST_ITEM } from './files.service';
import { PrismaService } from '../prisma/prisma.service';
import { writeFileSync, existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

type PrismaMock = {
  dossier: { findUnique: jest.Mock };
  dossierChecklistItem: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  document: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    delete: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
};

const owner = { id: 'u1', role: 'user' };
const stranger = { id: 'u2', role: 'user' };
const admin = { id: 'admin1', role: 'admin' };

describe('FilesService', () => {
  let service: FilesService;
  let prisma: PrismaMock;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'filepilot-test-'));
    prisma = {
      dossier: { findUnique: jest.fn() },
      dossierChecklistItem: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      document: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [FilesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<FilesService>(FilesService);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('createDocument', () => {
    it('rejects when caller is not the dossier owner', async () => {
      prisma.dossier.findUnique.mockResolvedValue({
        id: 'd1',
        ownerUserId: owner.id,
      });
      await expect(
        service.createDocument(
          {
            dossierId: 'd1',
            filename: 'cv.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 12,
            storagePath: '/tmp/cv.pdf',
          },
          stranger,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('forwards params with the caller as owner', async () => {
      prisma.dossier.findUnique.mockResolvedValue({
        id: 'd1',
        ownerUserId: owner.id,
      });
      prisma.document.create.mockResolvedValue({ id: 'doc1' });
      const result = await service.createDocument(
        {
          dossierId: 'd1',
          filename: 'cv.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1234,
          storagePath: '/tmp/cv.pdf',
        },
        owner,
      );
      expect(prisma.document.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dossierId: 'd1',
          ownerUserId: owner.id,
          checklistItemId: null,
          filename: 'cv.pdf',
        }),
      });
      expect(result).toEqual({ id: 'doc1' });
    });

    it('rejects when checklist item belongs to another dossier', async () => {
      prisma.dossier.findUnique.mockResolvedValue({
        id: 'd1',
        ownerUserId: owner.id,
      });
      prisma.dossierChecklistItem.findUnique.mockResolvedValue({
        id: 'c1',
        dossierId: 'd-other',
        documents: [],
      });
      await expect(
        service.createDocument(
          {
            dossierId: 'd1',
            checklistItemId: 'c1',
            filename: 'cv.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1,
            storagePath: '/tmp/cv.pdf',
          },
          owner,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('enforces the per-item document limit', async () => {
      prisma.dossier.findUnique.mockResolvedValue({
        id: 'd1',
        ownerUserId: owner.id,
      });
      prisma.dossierChecklistItem.findUnique.mockResolvedValue({
        id: 'c1',
        dossierId: 'd1',
        documents: Array.from(
          { length: MAX_DOCS_PER_CHECKLIST_ITEM },
          (_, i) => ({ id: `d${i}` }),
        ),
      });
      await expect(
        service.createDocument(
          {
            dossierId: 'd1',
            checklistItemId: 'c1',
            filename: 'cv.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1,
            storagePath: '/tmp/cv.pdf',
          },
          owner,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('flips the checklist item to ok when attaching a document', async () => {
      prisma.dossier.findUnique.mockResolvedValue({
        id: 'd1',
        ownerUserId: owner.id,
      });
      prisma.dossierChecklistItem.findUnique.mockResolvedValue({
        id: 'c1',
        dossierId: 'd1',
        documents: [],
      });
      prisma.document.create.mockResolvedValue({ id: 'doc1' });

      await service.createDocument(
        {
          dossierId: 'd1',
          checklistItemId: 'c1',
          filename: 'cv.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1,
          storagePath: '/tmp/cv.pdf',
        },
        owner,
      );

      expect(prisma.dossierChecklistItem.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: 'ok' },
      });
    });
  });

  describe('replaceDocument', () => {
    it('keeps the same row id and updates the file metadata', async () => {
      const oldPath = join(tmpDir, 'old.pdf');
      writeFileSync(oldPath, 'old');
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc1',
        ownerUserId: owner.id,
        storagePath: oldPath,
        checklistItemId: 'c1',
      });
      prisma.document.update.mockResolvedValue({
        id: 'doc1',
        filename: 'new.pdf',
      });

      const result = await service.replaceDocument(
        'doc1',
        {
          filename: 'new.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 9,
          storagePath: '/tmp/new.pdf',
        },
        owner,
      );

      expect(existsSync(oldPath)).toBe(false);
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc1' },
        data: {
          filename: 'new.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 9,
          storagePath: '/tmp/new.pdf',
        },
      });
      expect(result.filename).toBe('new.pdf');
    });

    it('refuses to replace someone else’s document', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc1',
        ownerUserId: owner.id,
        storagePath: '/tmp/x',
      });
      await expect(
        service.replaceDocument(
          'doc1',
          {
            filename: 'n',
            mimeType: 'application/pdf',
            sizeBytes: 1,
            storagePath: '/tmp/n',
          },
          stranger,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listByDossier', () => {
    it('returns ordered documents for the owner', async () => {
      prisma.dossier.findUnique.mockResolvedValue({
        id: 'd1',
        ownerUserId: owner.id,
      });
      const docs = [{ id: 'd2' }, { id: 'd1' }];
      prisma.document.findMany.mockResolvedValue(docs);
      const result = await service.listByDossier('d1', owner);
      expect(prisma.document.findMany).toHaveBeenCalledWith({
        where: { dossierId: 'd1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toBe(docs);
    });

    it('rejects strangers', async () => {
      prisma.dossier.findUnique.mockResolvedValue({
        id: 'd1',
        ownerUserId: owner.id,
      });
      await expect(service.listByDossier('d1', stranger)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('admin can list any dossier files', async () => {
      prisma.dossier.findUnique.mockResolvedValue({
        id: 'd1',
        ownerUserId: owner.id,
      });
      prisma.document.findMany.mockResolvedValue([{ id: 'doc1' }]);
      await expect(service.listByDossier('d1', admin)).resolves.toEqual([
        { id: 'doc1' },
      ]);
    });
  });

  describe('findOne', () => {
    it('throws when document missing', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing', owner)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects strangers', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc1',
        ownerUserId: owner.id,
        storagePath: '/tmp/x',
      });
      await expect(service.findOne('doc1', stranger)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('deleteDocument', () => {
    it('removes file from disk and prisma row', async () => {
      const filePath = join(tmpDir, 'cv.pdf');
      writeFileSync(filePath, 'dummy content');
      expect(existsSync(filePath)).toBe(true);

      prisma.document.findUnique.mockResolvedValue({
        id: 'doc1',
        ownerUserId: owner.id,
        storagePath: filePath,
        checklistItemId: null,
      });
      prisma.document.delete.mockResolvedValue({ id: 'doc1' });

      await service.deleteDocument('doc1', owner);

      expect(existsSync(filePath)).toBe(false);
      expect(prisma.document.delete).toHaveBeenCalledWith({
        where: { id: 'doc1' },
      });
    });

    it('tolerates missing physical file', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc1',
        ownerUserId: owner.id,
        storagePath: join(tmpDir, 'never-existed.pdf'),
        checklistItemId: null,
      });
      prisma.document.delete.mockResolvedValue({ id: 'doc1' });
      await expect(
        service.deleteDocument('doc1', owner),
      ).resolves.toBeDefined();
    });

    it('reverts the checklist item to todo when removing the last document', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc1',
        ownerUserId: owner.id,
        storagePath: '/tmp/x',
        checklistItemId: 'c1',
      });
      prisma.document.delete.mockResolvedValue({ id: 'doc1' });
      prisma.document.count.mockResolvedValue(0);

      await service.deleteDocument('doc1', owner);

      expect(prisma.dossierChecklistItem.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: 'todo' },
      });
    });

    it('keeps the checklist item ok when other documents remain', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc1',
        ownerUserId: owner.id,
        storagePath: '/tmp/x',
        checklistItemId: 'c1',
      });
      prisma.document.delete.mockResolvedValue({ id: 'doc1' });
      prisma.document.count.mockResolvedValue(2);

      await service.deleteDocument('doc1', owner);

      expect(prisma.dossierChecklistItem.update).not.toHaveBeenCalled();
    });
  });
});
