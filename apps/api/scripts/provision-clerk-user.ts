import { createClerkClient } from '@clerk/backend';
import { ConfigModule } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { parseProvisionArgs, provisionUser } from './provision-user.js';

async function main() {
  const { clerkUserId, target } = parseProvisionArgs(process.argv.slice(2));
  await ConfigModule.forRoot({ envFilePath: ['.env', '../../.env'] });
  const connectionString = process.env.DATABASE_URL;
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!connectionString || !secretKey)
    throw new Error('DATABASE_URL and CLERK_SECRET_KEY are required');
  const profile = await createClerkClient({ secretKey }).users.getUser(
    clerkUserId,
  );
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  try {
    const user = await provisionUser(prisma, profile, target);
    console.log(`Provisioned local user ${user.id}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  // Clerk/Prisma errors may contain credentials or personal information.
  console.error(
    'Provisioning failed. Check arguments, configuration, account existence, verified email, and identity/email collisions. No automatic merge or relink is performed.',
  );
  process.exitCode = 1;
});
