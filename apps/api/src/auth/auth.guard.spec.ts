import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard, PUBLIC_KEY, ROLES_KEY } from './auth.guard';
import { PrismaService } from '../prisma/prisma.service';

type ReflectorMock = { getAllAndOverride: jest.Mock };
type PrismaMock = { user: { findUnique: jest.Mock } };

function buildContext(headers: Record<string, string | string[] | undefined>) {
  const req: { headers: typeof headers; user?: unknown } = { headers };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => 'handler',
    getClass: () => 'class',
  } as unknown as ExecutionContext;
  return { ctx, req };
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let reflector: ReflectorMock;
  let prisma: PrismaMock;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    prisma = { user: { findUnique: jest.fn() } };
    guard = new AuthGuard(
      prisma as unknown as PrismaService,
      reflector as unknown as Reflector,
    );
  });

  it('lets through routes marked @Public()', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === PUBLIC_KEY ? true : undefined,
    );
    const { ctx } = buildContext({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects requests missing the x-user-id header', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const { ctx } = buildContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects requests with an unknown user id', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    prisma.user.findUnique.mockResolvedValue(null);
    const { ctx } = buildContext({ 'x-user-id': 'ghost' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('accepts an array header value (takes the first entry)', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.fr',
      role: 'user',
    });
    const { ctx, req } = buildContext({ 'x-user-id': ['u1', 'u2'] });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { id: true, email: true, role: true },
    });
    expect((req as { user?: { role: string } }).user?.role).toBe('user');
  });

  it('attaches the user on success and returns true', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const dbUser = { id: 'u1', email: 'a@b.fr', role: 'user' };
    prisma.user.findUnique.mockResolvedValue(dbUser);
    const { ctx, req } = buildContext({ 'x-user-id': 'u1' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect((req as { user?: typeof dbUser }).user).toEqual(dbUser);
  });

  it('rejects users that miss the required role', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === ROLES_KEY ? ['admin'] : undefined,
    );
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.fr',
      role: 'user',
    });
    const { ctx } = buildContext({ 'x-user-id': 'u1' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('lets admins through admin-only routes', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === ROLES_KEY ? ['admin'] : undefined,
    );
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin1',
      email: 'a@b.fr',
      role: 'admin',
    });
    const { ctx } = buildContext({ 'x-user-id': 'admin1' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
