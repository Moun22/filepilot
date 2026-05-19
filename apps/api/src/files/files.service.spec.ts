import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FilesService } from './files.service';
import { PrismaService } from '../prisma/prisma.service';
import { writeFileSync, existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

type PrismaMock = {
  document: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    delete: jest.Mock;
  };
};

describe('FilesService', () => {
  let service: FilesService;
  let prisma: PrismaMock;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'filepilot-test-'));
    prisma = {
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

  it('createDocument forwards params to prisma', async () => {
    prisma.document.create.mockResolvedValue({ id: 'doc1' });
    const params = {
      dossierId: 'd1',
      ownerUserId: 'u1',
      filename: 'cv.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1234,
      storagePath: '/tmp/cv.pdf',
    };
    const result = await service.createDocument(params);
    expect(prisma.document.create).toHaveBeenCalledWith({ data: params });
    expect(result).toEqual({ id: 'doc1' });
  });

  it('listByDossier returns ordered documents', async () => {
    const docs = [{ id: 'd2' }, { id: 'd1' }];
    prisma.document.findMany.mockResolvedValue(docs);
    const result = await service.listByDossier('dossier1');
    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: { dossierId: 'dossier1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toBe(docs);
  });

  it('findOne throws when document missing', async () => {
    prisma.document.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('deleteDocument removes file from disk and prisma row', async () => {
    const filePath = join(tmpDir, 'cv.pdf');
    writeFileSync(filePath, 'dummy content');
    expect(existsSync(filePath)).toBe(true);

    prisma.document.findUnique.mockResolvedValue({
      id: 'doc1',
      storagePath: filePath,
    });
    prisma.document.delete.mockResolvedValue({ id: 'doc1' });

    await service.deleteDocument('doc1');

    expect(existsSync(filePath)).toBe(false);
    expect(prisma.document.delete).toHaveBeenCalledWith({
      where: { id: 'doc1' },
    });
  });

  it('deleteDocument tolerates missing physical file', async () => {
    prisma.document.findUnique.mockResolvedValue({
      id: 'doc1',
      storagePath: join(tmpDir, 'never-existed.pdf'),
    });
    prisma.document.delete.mockResolvedValue({ id: 'doc1' });
    await expect(service.deleteDocument('doc1')).resolves.toBeDefined();
  });
});
