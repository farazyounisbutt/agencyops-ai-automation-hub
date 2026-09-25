import { Prisma, type PrismaClient } from '../src/generated/prisma/client.js';

export type ProvisionTarget =
  { mode: 'link'; userId: string } | { mode: 'create' };
export type ClerkProfile = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  primaryEmailAddressId: string | null;
  emailAddresses: {
    id: string;
    emailAddress: string;
    verification: { status: string } | null;
  }[];
};

export async function provisionUser(
  prisma: PrismaClient,
  profile: ClerkProfile,
  target: ProvisionTarget,
) {
  const existing = await prisma.user.findUnique({
    where: { clerkUserId: profile.id },
  });
  if (existing) {
    if (target.mode === 'link' && existing.id !== target.userId)
      throw new Error('Clerk identity already belongs to another local user');
    return existing;
  }
  try {
    if (target.mode === 'link') {
      return await prisma.$transaction(async (tx) => {
        const result = await tx.user.updateMany({
          where: { id: target.userId, clerkUserId: null },
          data: { clerkUserId: profile.id },
        });
        const user = await tx.user.findUnique({ where: { id: target.userId } });
        if (!user) throw new Error('Local user does not exist');
        if (result.count === 0 && user.clerkUserId !== profile.id)
          throw new Error(
            'Local user is already linked to another Clerk identity',
          );
        return user;
      });
    }
    const email = profile.emailAddresses.find(
      (item) => item.id === profile.primaryEmailAddressId,
    );
    if (!email || email.verification?.status !== 'verified')
      throw new Error('A verified primary Clerk email is required');
    return await prisma.user.create({
      data: {
        clerkUserId: profile.id,
        email: email.emailAddress,
        name:
          [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
          null,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      // A concurrent operation linking this exact identity may already have won.
      const winner = await prisma.user.findUnique({
        where: { clerkUserId: profile.id },
      });
      if (winner && (target.mode === 'create' || winner.id === target.userId))
        return winner;
      throw new Error(
        'Identity or email collision; explicitly link the correct existing user. No account was merged',
      );
    }
    throw error;
  }
}

export function parseProvisionArgs(args: string[]): {
  clerkUserId: string;
  target: ProvisionTarget;
} {
  const [mode, clerkUserId, userId, ...extra] = args;
  if (!clerkUserId?.startsWith('user_') || extra.length > 0)
    throw new Error('Invalid provisioning arguments');
  if (mode === 'create' && userId === undefined)
    return { clerkUserId, target: { mode } };
  if (
    mode === 'link' &&
    userId &&
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(userId)
  ) {
    return { clerkUserId, target: { mode, userId } };
  }
  throw new Error(
    'Use: provision-user link <clerk-user-id> <local-user-uuid> OR provision-user create <clerk-user-id>',
  );
}
