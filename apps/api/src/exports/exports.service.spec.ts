import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExportsService } from './exports.service';
import { PrismaService } from '../prisma/prisma.service';
import { writeFileSync, mkdtempSync, rmSync, readFileSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';

type PrismaMock = {
  dossier: { findUnique: jest.Mock };
  export: { create: jest.Mock; findMany: jest.Mock };
};

function drain(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (c) => chunks.push(c as Buffer));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

describe('ExportsService', () => {
  let service: ExportsService;
  let prisma: PrismaMock;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'filepilot-zip-'));

    prisma = {
      dossier: { findUnique: jest.fn() },
      export: { create: jest.fn(), findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ExportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ExportsService>(ExportsService);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('throws when dossier missing', async () => {
    prisma.dossier.findUnique.mockResolvedValue(null);
    await expect(service.generateZip('d1', 'u1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws when dossier has no documents', async () => {
    prisma.dossier.findUnique.mockResolvedValue({
      id: 'd1',
      documents: [],
      checklistItems: [],
      procedureType: {
        slug: 'caf-apl',
        name: 'APL',
        organization: { name: 'CAF' },
      },
      title: null,
    });
    await expect(service.generateZip('d1', 'u1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('produces a non-empty zip stream and records the export', async () => {
    const docPath = join(tmpDir, 'cv.pdf');
    writeFileSync(docPath, 'dummy pdf content');

    prisma.dossier.findUnique.mockResolvedValue({
      id: 'd1',
      title: 'Mon dossier',
      documents: [
        {
          id: 'doc1',
          filename: 'cv.pdf',
          storagePath: docPath,
        },
      ],
      checklistItems: [
        { key: 'id_doc', label: 'ID', required: true, status: 'ok' },
        { key: 'photo', label: 'Photo', required: false, status: 'todo' },
      ],
      procedureType: {
        slug: 'caf-apl',
        name: 'APL',
        organization: { name: 'CAF' },
      },
    });
    prisma.export.create.mockResolvedValue({ id: 'ex1' });

    const { stream, filename } = await service.generateZip('d1', 'u1');

    expect(filename).toMatch(/filepilot-caf-apl-\d+\.zip/);
    expect(prisma.export.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dossierId: 'd1',
        ownerUserId: 'u1',
        type: 'zip',
      }),
    });

    const storedPath: string =
      prisma.export.create.mock.calls[0][0].data.storagePath;
    expect(statSync(storedPath).size).toBeGreaterThan(0);

    const buf = await drain(stream);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.slice(0, 2).toString()).toBe('PK');

    rmSync(storedPath, { force: true });
  });

  it('skips documents whose physical file is missing without failing', async () => {
    const docPath = join(tmpDir, 'present.pdf');
    writeFileSync(docPath, 'hi');

    prisma.dossier.findUnique.mockResolvedValue({
      id: 'd1',
      title: null,
      documents: [
        { id: 'd1', filename: 'present.pdf', storagePath: docPath },
        {
          id: 'd2',
          filename: 'ghost.pdf',
          storagePath: join(tmpDir, 'ghost.pdf'),
        },
      ],
      checklistItems: [],
      procedureType: {
        slug: 'pref-x',
        name: 'X',
        organization: { name: 'Préfecture' },
      },
    });
    prisma.export.create.mockResolvedValue({ id: 'ex1' });

    const { stream } = await service.generateZip('d1', 'u1');
    const buf = await drain(stream);
    expect(buf.length).toBeGreaterThan(0);

    const storedPath: string =
      prisma.export.create.mock.calls[0][0].data.storagePath;
    expect(readFileSync(storedPath).length).toBeGreaterThan(0);
    rmSync(storedPath, { force: true });
  });

  it('listByDossier returns prisma rows ordered by createdAt desc', async () => {
    const rows = [{ id: 'ex2' }, { id: 'ex1' }];
    prisma.export.findMany.mockResolvedValue(rows);
    const result = await service.listByDossier('d1');
    expect(prisma.export.findMany).toHaveBeenCalledWith({
      where: { dossierId: 'd1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toBe(rows);
  });
});
