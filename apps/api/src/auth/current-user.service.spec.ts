import { ForbiddenException } from '@nestjs/common';
import { CurrentUserService } from './current-user.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('CurrentUserService', () => {
  const findUnique = vi.fn();
  const service = new CurrentUserService({
    user: { findUnique },
  } as unknown as PrismaService);
  beforeEach(() => {
    findUnique.mockReset();
  });
  it('looks up only the verified Clerk identity and selects public profile fields', async () => {
    const user = { id: 'local', email: 'local@example.com', name: 'Local' };
    findUnique.mockResolvedValue(user);
    await expect(service.find('user_verified')).resolves.toEqual(user);
    expect(findUnique).toHaveBeenCalledWith({
      where: { clerkUserId: 'user_verified' },
      select: { id: true, email: true, name: true },
    });
  });
  it('denies unprovisioned users without provisioning', async () => {
    findUnique.mockResolvedValue(null);
    await expect(service.find('user_unknown')).rejects.toThrow(
      ForbiddenException,
    );
  });
  it('propagates database failures without granting access', async () => {
    const error = new Error('Database failure');
    findUnique.mockRejectedValue(error);
    await expect(service.find('user_verified')).rejects.toBe(error);
  });
});
