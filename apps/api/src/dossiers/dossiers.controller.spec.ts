import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { DossiersController } from './dossiers.controller';
import { DossiersService } from './dossiers.service';
import type { AuthUser } from '../auth/auth.guard';

const user: AuthUser = { id: 'u1', email: 'a@b.fr', role: 'user' };

describe('DossiersController', () => {
  let controller: DossiersController;
  let service: {
    createDossier: jest.Mock;
    findAllByUser: jest.Mock;
    findOne: jest.Mock;
    updateChecklistItem: jest.Mock;
    deleteDossier: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      createDossier: jest.fn(),
      findAllByUser: jest.fn(),
      findOne: jest.fn(),
      updateChecklistItem: jest.fn(),
      deleteDossier: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DossiersController],
      providers: [{ provide: DossiersService, useValue: service }],
    }).compile();
    controller = module.get<DossiersController>(DossiersController);
  });

  it('create passes the caller as owner', async () => {
    service.createDossier.mockResolvedValue({ id: 'd1' });
    await controller.create({ procedureTypeId: 'pt1', title: 'X' }, user);
    expect(service.createDossier).toHaveBeenCalledWith({
      ownerUserId: 'u1',
      procedureTypeId: 'pt1',
      title: 'X',
    });
  });

  it('findAll scopes to the caller', async () => {
    service.findAllByUser.mockResolvedValue([]);
    await controller.findAll(user);
    expect(service.findAllByUser).toHaveBeenCalledWith('u1');
  });

  it('findOne forwards id and user', async () => {
    service.findOne.mockResolvedValue({ id: 'd1' });
    await controller.findOne('d1', user);
    expect(service.findOne).toHaveBeenCalledWith('d1', user);
  });

  it('updateChecklist forwards id, key, status and user', async () => {
    service.updateChecklistItem.mockResolvedValue({ id: 'c1', status: 'ok' });
    await controller.updateChecklist('d1', 'id_doc', { status: 'ok' }, user);
    expect(service.updateChecklistItem).toHaveBeenCalledWith(
      'd1',
      'id_doc',
      'ok',
      user,
    );
  });

  it('remove rejects an empty id', () => {
    expect(() => controller.remove('', user)).toThrow(ForbiddenException);
  });

  it('remove forwards id and user', async () => {
    service.deleteDossier.mockResolvedValue({ id: 'd1' });
    await controller.remove('d1', user);
    expect(service.deleteDossier).toHaveBeenCalledWith('d1', user);
  });
});
