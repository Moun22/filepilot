import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FilesService } from './files.service';
import { PrismaService } from '../prisma/prisma.service';
import { writeFileSync, existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

type PrismaMock = {
  dossier: { findUnique: jest.Mock };
  document: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    delete: jest.Mock;
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
      document: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
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

  it('createDocument rejects when caller is not the dossier owner', async () => {
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

  it('createDocument forwards params with the caller as owner', async () => {
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
        filename: 'cv.pdf',
      }),
    });
    expect(result).toEqual({ id: 'doc1' });
  });

  it('listByDossier returns ordered documents for the owner', async () => {
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

  it('listByDossier rejects strangers', async () => {
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

  it('findOne throws when document missing', async () => {
    prisma.document.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing', owner)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('findOne rejects strangers', async () => {
    prisma.document.findUnique.mockResolvedValue({
      id: 'doc1',
      ownerUserId: owner.id,
      storagePath: '/tmp/x',
    });
    await expect(service.findOne('doc1', stranger)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('deleteDocument removes file from disk and prisma row', async () => {
    const filePath = join(tmpDir, 'cv.pdf');
    writeFileSync(filePath, 'dummy content');
    expect(existsSync(filePath)).toBe(true);

    prisma.document.findUnique.mockResolvedValue({
      id: 'doc1',
      ownerUserId: owner.id,
      storagePath: filePath,
    });
    prisma.document.delete.mockResolvedValue({ id: 'doc1' });

    await service.deleteDocument('doc1', owner);

    expect(existsSync(filePath)).toBe(false);
    expect(prisma.document.delete).toHaveBeenCalledWith({
      where: { id: 'doc1' },
    });
  });

  it('deleteDocument tolerates missing physical file', async () => {
    prisma.document.findUnique.mockResolvedValue({
      id: 'doc1',
      ownerUserId: owner.id,
      storagePath: join(tmpDir, 'never-existed.pdf'),
    });
    prisma.document.delete.mockResolvedValue({ id: 'doc1' });
    await expect(service.deleteDocument('doc1', owner)).resolves.toBeDefined();
  });
});
