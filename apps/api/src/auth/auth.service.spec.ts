import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  user: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('rejects when email or password missing', async () => {
      await expect(service.register('', 'secret')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.register('a@b.fr', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.fr' });
      await expect(service.register('a@b.fr', 'secret')).rejects.toThrow(
        ConflictException,
      );
    });

    it('hashes password and creates user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'u1',
          email: data.email,
          passwordHash: data.passwordHash,
          createdAt: new Date('2025-01-01'),
        }),
      );

      const result = await service.register('a@b.fr', 'secret');

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      const created = prisma.user.create.mock.calls[0][0].data;
      expect(created.email).toBe('a@b.fr');
      expect(created.passwordHash).not.toBe('secret');
      expect(await bcrypt.compare('secret', created.passwordHash)).toBe(true);
      expect(result).toEqual({
        id: 'u1',
        email: 'a@b.fr',
        createdAt: expect.any(Date),
      });
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('login', () => {
    it('rejects unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login('a@b.fr', 'secret')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects wrong password', async () => {
      const hash = await bcrypt.hash('right-password', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.fr',
        passwordHash: hash,
        createdAt: new Date(),
      });
      await expect(service.login('a@b.fr', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns user info on success', async () => {
      const hash = await bcrypt.hash('secret', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.fr',
        passwordHash: hash,
        createdAt: new Date('2025-01-01'),
      });

      const result = await service.login('a@b.fr', 'secret');
      expect(result).toEqual({
        id: 'u1',
        email: 'a@b.fr',
        createdAt: expect.any(Date),
      });
      expect(result).not.toHaveProperty('passwordHash');
    });
  });
});
