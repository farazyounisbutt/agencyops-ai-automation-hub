import { Prisma, type PrismaClient } from '../src/generated/prisma/client.js';
import {
  parseProvisionArgs,
  provisionUser,
  type ClerkProfile,
} from './provision-user.js';

const profile: ClerkProfile = {
  id: 'user_operator',
  firstName: 'Approved',
  lastName: 'User',
  primaryEmailAddressId: 'email_1',
  emailAddresses: [
    {
      id: 'email_1',
      emailAddress: 'approved@example.com',
      verification: { status: 'verified' },
    },
  ],
};

describe('operator provisioning', () => {
  let user: {
    findUnique: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let prisma: PrismaClient;
  beforeEach(() => {
    user = { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() };
    prisma = {
      user,
      $transaction: async (callback: (tx: unknown) => unknown) =>
        callback({ user }),
    } as unknown as PrismaClient;
  });
  it('creates only an explicitly requested user with a verified primary email', async () => {
    user.create.mockResolvedValue({ id: 'local' });
    await provisionUser(prisma, profile, { mode: 'create' });
    expect(user.create).toHaveBeenCalledWith({
      data: {
        clerkUserId: profile.id,
        email: 'approved@example.com',
        name: 'Approved User',
      },
    });
  });
  it.each([null, 'unverified'])(
    'rejects absent or unverified primary email: %s',
    async (status) => {
      const input = {
        ...profile,
        emailAddresses: status
          ? [{ ...profile.emailAddresses[0]!, verification: { status } }]
          : [],
      };
      await expect(
        provisionUser(prisma, input, { mode: 'create' }),
      ).rejects.toThrow('verified primary');
      expect(user.create).not.toHaveBeenCalled();
    },
  );
  it('links by local UUID and updates only the identity field', async () => {
    user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'local', clerkUserId: profile.id });
    user.updateMany.mockResolvedValue({ count: 1 });
    await provisionUser(prisma, profile, { mode: 'link', userId: 'local' });
    expect(user.updateMany).toHaveBeenCalledWith({
      where: { id: 'local', clerkUserId: null },
      data: { clerkUserId: profile.id },
    });
    expect(user.create).not.toHaveBeenCalled();
  });
  it('accepts an existing identical link without rewriting', async () => {
    const existing = { id: 'local', clerkUserId: profile.id };
    user.findUnique.mockResolvedValue(existing);
    await expect(
      provisionUser(prisma, profile, { mode: 'link', userId: 'local' }),
    ).resolves.toEqual(existing);
    expect(user.updateMany).not.toHaveBeenCalled();
  });
  it('refuses another local user already owning the Clerk identity', async () => {
    user.findUnique.mockResolvedValue({ id: 'other', clerkUserId: profile.id });
    await expect(
      provisionUser(prisma, profile, { mode: 'link', userId: 'local' }),
    ).rejects.toThrow('another local user');
    expect(user.updateMany).not.toHaveBeenCalled();
  });
  it('refuses to relink a local user to a different identity', async () => {
    user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'local', clerkUserId: 'user_other' });
    user.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      provisionUser(prisma, profile, { mode: 'link', userId: 'local' }),
    ).rejects.toThrow('already linked');
  });
  it('refuses missing local users', async () => {
    user.findUnique.mockResolvedValue(null);
    user.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      provisionUser(prisma, profile, { mode: 'link', userId: 'missing' }),
    ).rejects.toThrow('does not exist');
  });
  it('does not merge or automatically link on an email collision', async () => {
    user.findUnique.mockResolvedValue(null);
    user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique violation', {
        code: 'P2002',
        clientVersion: '7.9.1',
      }),
    );
    await expect(
      provisionUser(prisma, profile, { mode: 'create' }),
    ).rejects.toThrow('collision');
    expect(user.updateMany).not.toHaveBeenCalled();
  });
  it('preserves unrelated provisioning database errors', async () => {
    const error = new Error('Database offline');
    user.create.mockRejectedValue(error);
    await expect(
      provisionUser(prisma, profile, { mode: 'create' }),
    ).rejects.toBe(error);
  });
  it('requires explicit CLI modes and IDs', () => {
    expect(parseProvisionArgs(['create', profile.id])).toEqual({
      clerkUserId: profile.id,
      target: { mode: 'create' },
    });
    expect(
      parseProvisionArgs([
        'link',
        profile.id,
        '11111111-1111-4111-8111-111111111111',
      ]).target.mode,
    ).toBe('link');
    for (const args of [
      [],
      ['create'],
      ['create', profile.id, 'extra'],
      ['link', profile.id],
      ['link', profile.id, 'not-uuid'],
      ['merge', profile.id],
    ]) {
      expect(() => parseProvisionArgs(args)).toThrow();
    }
  });
});
