import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import type { AuthUser } from '../auth/auth.guard';

const admin: AuthUser = { id: 'admin1', email: 'a@b.fr', role: 'admin' };

describe('AdminController', () => {
  let controller: AdminController;
  let service: {
    stats: jest.Mock;
    listUsers: jest.Mock;
    setUserRole: jest.Mock;
    deleteUser: jest.Mock;
    listAllDossiers: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      stats: jest.fn(),
      listUsers: jest.fn(),
      setUserRole: jest.fn(),
      deleteUser: jest.fn(),
      listAllDossiers: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: service }],
    }).compile();
    controller = module.get<AdminController>(AdminController);
  });

  it('stats delegates to the service', async () => {
    service.stats.mockResolvedValue({ users: 2 });
    await controller.stats();
    expect(service.stats).toHaveBeenCalled();
  });

  it('listUsers delegates to the service', async () => {
    service.listUsers.mockResolvedValue([]);
    await controller.listUsers();
    expect(service.listUsers).toHaveBeenCalled();
  });

  it('updateRole passes id, role and caller id', async () => {
    service.setUserRole.mockResolvedValue({ id: 'u2', role: 'admin' });
    await controller.updateRole('u2', { role: 'admin' }, admin);
    expect(service.setUserRole).toHaveBeenCalledWith('u2', 'admin', 'admin1');
  });

  it('deleteUser passes id and caller id', async () => {
    service.deleteUser.mockResolvedValue({ ok: true });
    await controller.deleteUser('u2', admin);
    expect(service.deleteUser).toHaveBeenCalledWith('u2', 'admin1');
  });

  it('listAllDossiers delegates to the service', async () => {
    service.listAllDossiers.mockResolvedValue([]);
    await controller.listAllDossiers();
    expect(service.listAllDossiers).toHaveBeenCalled();
  });
});
