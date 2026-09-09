import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, WorkspaceRole } from '../src/generated/prisma/client.js';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to seed the database.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.upsert({
        where: { slug: 'agencyops-demo' },
        update: {},
        create: { name: 'AgencyOps Demo', slug: 'agencyops-demo' },
      });
      const owner = await tx.user.upsert({
        where: { email: 'owner@agencyops.example' },
        update: {},
        create: { name: 'Demo Owner', email: 'owner@agencyops.example' },
      });
      await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: { workspaceId: workspace.id, userId: owner.id },
        },
        update: { role: WorkspaceRole.OWNER },
        create: {
          workspaceId: workspace.id,
          userId: owner.id,
          role: WorkspaceRole.OWNER,
        },
      });

      for (const client of [
        { name: 'Acme Studio', slug: 'acme-studio' },
        { name: 'Northstar Labs', slug: 'northstar-labs' },
      ]) {
        await tx.client.upsert({
          where: {
            workspaceId_slug: { workspaceId: workspace.id, slug: client.slug },
          },
          update: {},
          create: { ...client, workspaceId: workspace.id },
        });
      }
    });
    console.log('Demo seed complete: agencyops-demo, one OWNER, two clients.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error('Demo seed failed. Check DATABASE_URL and applied migrations.');
  process.exitCode = 1;
});
