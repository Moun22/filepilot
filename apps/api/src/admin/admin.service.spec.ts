import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  user: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  dossier: {
    findMany: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  document: { deleteMany: jest.Mock; count: jest.Mock };
  export: { deleteMany: jest.Mock; count: jest.Mock };
  $transaction: jest.Mock;
};

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      dossier: {
        findMany: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      document: { deleteMany: jest.fn(), count: jest.fn() },
      export: { deleteMany: jest.fn(), count: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('setUserRole', () => {
    it('rejects invalid role', async () => {
      await expect(service.setUserRole('u1', 'super', 'me')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('forbids self-demotion', async () => {
      await expect(service.setUserRole('me', 'user', 'me')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when user missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.setUserRole('u1', 'admin', 'me')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('promotes a user to admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.user.update.mockResolvedValue({
        id: 'u1',
        email: 'a@b.fr',
        role: 'admin',
      });
      const result = await service.setUserRole('u1', 'admin', 'me');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { role: 'admin' },
        select: { id: true, email: true, role: true },
      });
      expect(result.role).toBe('admin');
    });
  });

  describe('deleteUser', () => {
    it('forbids self-deletion', async () => {
      await expect(service.deleteUser('me', 'me')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.deleteUser('u1', 'me')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('removes dossiers, orphan documents, exports and the user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        dossiers: [{ id: 'd1' }, { id: 'd2' }],
      });
      prisma.dossier.delete.mockResolvedValue({});
      prisma.document.deleteMany.mockResolvedValue({ count: 3 });
      prisma.export.deleteMany.mockResolvedValue({ count: 1 });
      prisma.user.delete.mockResolvedValue({});

      const result = await service.deleteUser('u1', 'me');

      expect(prisma.dossier.delete).toHaveBeenCalledTimes(2);
      expect(prisma.document.deleteMany).toHaveBeenCalledWith({
        where: { ownerUserId: 'u1' },
      });
      expect(prisma.export.deleteMany).toHaveBeenCalledWith({
        where: { ownerUserId: 'u1' },
      });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
      expect(result).toEqual({ id: 'u1', deleted: true });
    });
  });

  it('listUsers exposes _count.dossiers for the dashboard', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    await service.listUsers();
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          _count: { select: { dossiers: true } },
        }),
      }),
    );
  });

  it('stats aggregates four counters', async () => {
    prisma.$transaction.mockResolvedValue([7, 4, 12, 3]);
    const result = await service.stats();
    expect(result).toEqual({
      users: 7,
      dossiers: 4,
      documents: 12,
      exports: 3,
    });
  });
});
