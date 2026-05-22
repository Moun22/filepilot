import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import type { AuthUser } from '../auth/auth.guard';

const user: AuthUser = { id: 'u1', email: 'a@b.fr', role: 'user' };

function makeMulterFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'cv.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1234,
    destination: '/tmp',
    filename: '123.pdf',
    path: '/tmp/123.pdf',
    buffer: Buffer.alloc(0),
    stream: undefined as never,
    ...overrides,
  } as Express.Multer.File;
}

describe('FilesController', () => {
  let controller: FilesController;
  let service: {
    createDocument: jest.Mock;
    replaceDocument: jest.Mock;
    listByDossier: jest.Mock;
    findOne: jest.Mock;
    deleteDocument: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      createDocument: jest.fn(),
      replaceDocument: jest.fn(),
      listByDossier: jest.fn(),
      findOne: jest.fn(),
      deleteDocument: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [{ provide: FilesService, useValue: service }],
    }).compile();
    controller = module.get<FilesController>(FilesController);
  });

  describe('uploadFile', () => {
    it('rejects when no file is attached', () => {
      expect(() =>
        controller.uploadFile(
          undefined as unknown as Express.Multer.File,
          'd1',
          undefined,
          user,
        ),
      ).toThrow(BadRequestException);
    });

    it('rejects when dossierId is missing', () => {
      expect(() =>
        controller.uploadFile(makeMulterFile(), '', undefined, user),
      ).toThrow(BadRequestException);
    });

    it('forwards the upload to the service', async () => {
      service.createDocument.mockResolvedValue({ id: 'doc1' });
      await controller.uploadFile(makeMulterFile(), 'd1', 'c1', user);
      expect(service.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          dossierId: 'd1',
          checklistItemId: 'c1',
          filename: 'cv.pdf',
          mimeType: 'application/pdf',
        }),
        user,
      );
    });

    it('treats a missing checklistItemId as null', async () => {
      service.createDocument.mockResolvedValue({ id: 'doc1' });
      await controller.uploadFile(makeMulterFile(), 'd1', undefined, user);
      expect(service.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({ checklistItemId: null }),
        user,
      );
    });
  });

  describe('replace', () => {
    it('rejects when no file is attached', () => {
      expect(() =>
        controller.replace(
          'doc1',
          undefined as unknown as Express.Multer.File,
          user,
        ),
      ).toThrow(BadRequestException);
    });

    it('forwards the new file to the service', async () => {
      service.replaceDocument.mockResolvedValue({ id: 'doc1' });
      await controller.replace(
        'doc1',
        makeMulterFile({ originalname: 'new.pdf' }),
        user,
      );
      expect(service.replaceDocument).toHaveBeenCalledWith(
        'doc1',
        expect.objectContaining({ filename: 'new.pdf' }),
        user,
      );
    });
  });

  it('listByDossier scopes by the caller', async () => {
    service.listByDossier.mockResolvedValue([]);
    await controller.listByDossier('d1', user);
    expect(service.listByDossier).toHaveBeenCalledWith('d1', user);
  });

  it('download streams the resolved file via res.download', async () => {
    service.findOne.mockResolvedValue({
      id: 'doc1',
      storagePath: '/tmp/cv.pdf',
      filename: 'cv.pdf',
    });
    const res = { download: jest.fn() } as unknown as Response;
    await controller.download('doc1', user, res);
    expect(service.findOne).toHaveBeenCalledWith('doc1', user);
    expect((res as { download: jest.Mock }).download).toHaveBeenCalledWith(
      '/tmp/cv.pdf',
      'cv.pdf',
    );
  });

  it('deleteFile forwards to the service', async () => {
    service.deleteDocument.mockResolvedValue({ id: 'doc1' });
    await controller.deleteFile('doc1', user);
    expect(service.deleteDocument).toHaveBeenCalledWith('doc1', user);
  });
});
