import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: { register: jest.Mock; login: jest.Mock };

  beforeEach(async () => {
    service = { register: jest.fn(), login: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: service }],
    }).compile();
    controller = module.get<AuthController>(AuthController);
  });

  it('register forwards email + password to the service', async () => {
    service.register.mockResolvedValue({ id: 'u1', email: 'a@b.fr' });
    const out = await controller.register({
      email: 'a@b.fr',
      password: 'secret',
    });
    expect(service.register).toHaveBeenCalledWith('a@b.fr', 'secret');
    expect(out).toEqual({ id: 'u1', email: 'a@b.fr' });
  });

  it('login forwards email + password to the service', async () => {
    service.login.mockResolvedValue({ id: 'u1', email: 'a@b.fr' });
    const out = await controller.login({ email: 'a@b.fr', password: 'secret' });
    expect(service.login).toHaveBeenCalledWith('a@b.fr', 'secret');
    expect(out).toEqual({ id: 'u1', email: 'a@b.fr' });
  });
});
