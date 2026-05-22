import { Test, TestingModule } from '@nestjs/testing';
import { Readable } from 'stream';
import type { Response } from 'express';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';
import type { AuthUser } from '../auth/auth.guard';

const user: AuthUser = { id: 'u1', email: 'a@b.fr', role: 'user' };

describe('ExportsController', () => {
  let controller: ExportsController;
  let service: { generateZip: jest.Mock; listByDossier: jest.Mock };

  beforeEach(async () => {
    service = { generateZip: jest.fn(), listByDossier: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExportsController],
      providers: [{ provide: ExportsService, useValue: service }],
    }).compile();
    controller = module.get<ExportsController>(ExportsController);
  });

  it('exportZip sets ZIP headers and pipes the stream', async () => {
    const stream = Readable.from(Buffer.from('zip'));
    const pipe = jest
      .spyOn(stream, 'pipe')
      .mockImplementation((dest) => dest as never);
    service.generateZip.mockResolvedValue({
      stream,
      filename: 'dossier.zip',
    });
    const set = jest.fn();
    const res = { set } as unknown as Response;

    await controller.exportZip('d1', user, res);

    expect(service.generateZip).toHaveBeenCalledWith('d1', user);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="dossier.zip"',
      }),
    );
    expect(pipe).toHaveBeenCalledWith(res);
  });

  it('listByDossier forwards id and user', async () => {
    service.listByDossier.mockResolvedValue([]);
    await controller.listByDossier('d1', user);
    expect(service.listByDossier).toHaveBeenCalledWith('d1', user);
  });
});
