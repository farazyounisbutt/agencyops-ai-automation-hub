import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { provisionUser, type ClerkProfile } from '../scripts/provision-user.js';
import { sessionToken, testOrigin } from './support/clerk-fixture.js';

describe('Clerk authentication foundation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let linked: { id: string; email: string; name: string | null };
  const subject = `user_${randomUUID()}`;
  const userIds: string[] = [];
  const profileSubjects: string[] = [];
  const workspaceIds: string[] = [];
  const profile = (): ClerkProfile => {
    const id = `user_${randomUUID()}`;
    profileSubjects.push(id);
    return {
      id,
      firstName: 'Approved',
      lastName: 'User',
      primaryEmailAddressId: 'email_primary',
      emailAddresses: [
        {
          id: 'email_primary',
          emailAddress: `${randomUUID()}@auth-test.example`,
          verification: { status: 'verified' },
        },
      ],
    };
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    linked = await prisma.user.create({
      data: {
        clerkUserId: subject,
        email: `${randomUUID()}@auth-test.example`,
        name: 'Approved',
      },
    });
    userIds.push(linked.id);
  });
  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.workspace.deleteMany({
          where: { id: { in: workspaceIds } },
        });
        await prisma.user.deleteMany({
          where: {
            OR: [
              { id: { in: userIds } },
              { clerkUserId: { in: profileSubjects } },
            ],
          },
        });
      }
    } finally {
      await app?.close();
    }
  });
  const bearer = () => `Bearer ${sessionToken({ sub: subject })}`;
  it('returns only the linked local identity and ignores spoofed identity/role headers', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', bearer())
      .set('x-user-id', 'other-user')
      .set('x-workspace-id', randomUUID())
      .set('x-role', 'OWNER')
      .expect(200);
    expect(response.body).toEqual({
      id: linked.id,
      email: linked.email,
      name: linked.name,
    });
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('rejects absent, cookie-only, query-only, malformed and machine credentials', async () => {
    await request(app.getHttpServer()).get('/api/me').expect(401);
    await request(app.getHttpServer())
      .get(`/api/me?token=${sessionToken({ sub: subject })}`)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/me')
      .set('Cookie', `__session=${sessionToken({ sub: subject })}`)
      .expect(401);
    for (const token of [
      'Basic abc',
      'Bearer broken',
      'Bearer mt_test_invalid',
      'Bearer ak_test_invalid',
    ]) {
      await request(app.getHttpServer())
        .get('/api/me')
        .set('Authorization', token)
        .expect(401);
    }
  });
  it.each([
    { exp: 1 },
    { nbf: 9999999999 },
    { azp: 'https://attacker.example' },
    { azp: undefined },
    { sts: 'pending' },
  ])('rejects invalid session claims: %j', async (claims) => {
    await request(app.getHttpServer())
      .get('/api/me')
      .set(
        'Authorization',
        `Bearer ${sessionToken({ sub: subject, ...claims })}`,
      )
      .expect(401);
  });
  it('rejects a token from another signing key/instance and a tampered token', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const token = sessionToken(
      { sub: subject, iss: 'https://other.clerk.accounts.dev' },
      other.privateKey,
    );
    await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    const [header, payload] = sessionToken({ sub: subject }).split('.');
    await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${header}.${payload}.invalid`)
      .expect(401);
  });
  it('denies an unlinked identity without request-time provisioning', async () => {
    const unlinked = `user_${randomUUID()}`;
    await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${sessionToken({ sub: unlinked })}`)
      .expect(403);
    expect(
      await prisma.user.findUnique({ where: { clerkUserId: unlinked } }),
    ).toBeNull();
  });
  it('fails closed with a sanitized 500 when identity lookup fails', async () => {
    const lookup = vi
      .spyOn(prisma.user, 'findUnique')
      .mockRejectedValueOnce(new Error('private-database-diagnostic'));
    try {
      const response = await request(app.getHttpServer())
        .get('/api/me')
        .set('Authorization', bearer())
        .expect(500);
      expect(response.body).toEqual({
        statusCode: 500,
        message: 'Internal server error',
      });
    } finally {
      lookup.mockRestore();
    }
  });
  it('preserves public health and existing root behavior', async () => {
    await request(app.getHttpServer()).get('/api').expect(200, 'Hello World!');
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(response.body.status).toBe('ok');
  });
  it('supports authorized-origin Bearer preflight without cross-origin cookies', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/me')
      .set('Origin', testOrigin)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBe(testOrigin);
    expect(response.headers['access-control-allow-headers']).toContain(
      'authorization',
    );
    expect(
      response.headers['access-control-allow-credentials'],
    ).toBeUndefined();
  });
  it('operator linking preserves local fields, memberships and repeated links', async () => {
    const external = profile();
    const local = await prisma.user.create({
      data: {
        email: `${randomUUID()}@auth-test.example`,
        name: 'Existing name',
      },
    });
    userIds.push(local.id);
    const workspace = await prisma.workspace.create({
      data: { name: 'Auth test', slug: `auth-${randomUUID()}` },
    });
    workspaceIds.push(workspace.id);
    await prisma.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: local.id, role: 'REVIEWER' },
    });
    const mapped = await provisionUser(prisma, external, {
      mode: 'link',
      userId: local.id,
    });
    expect(mapped).toMatchObject({
      id: local.id,
      email: local.email,
      name: local.name,
      clerkUserId: external.id,
      createdAt: local.createdAt,
    });
    expect(
      await provisionUser(prisma, external, { mode: 'link', userId: local.id }),
    ).toEqual(mapped);
    expect(
      await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: workspace.id, userId: local.id },
        },
      }),
    ).toMatchObject({ role: 'REVIEWER' });
    await expect(
      provisionUser(prisma, profile(), { mode: 'link', userId: local.id }),
    ).rejects.toThrow('already linked');
    await expect(
      provisionUser(prisma, external, { mode: 'link', userId: linked.id }),
    ).rejects.toThrow('another local user');
  });
  it('operator creation is explicit, concurrent-idempotent and assigns no membership', async () => {
    const external = profile();
    const [one, two] = await Promise.all([
      provisionUser(prisma, external, { mode: 'create' }),
      provisionUser(prisma, external, { mode: 'create' }),
    ]);
    expect(one.id).toBe(two.id);
    expect(
      await prisma.user.count({ where: { clerkUserId: external.id } }),
    ).toBe(1);
    expect(
      await prisma.workspaceMember.count({ where: { userId: one.id } }),
    ).toBe(0);
  });
  it('email collisions never trigger automatic linking or merging', async () => {
    const external = profile();
    external.emailAddresses[0]!.emailAddress = linked.email;
    await expect(
      provisionUser(prisma, external, { mode: 'create' }),
    ).rejects.toThrow('collision');
    expect(
      await prisma.user.findUnique({ where: { clerkUserId: external.id } }),
    ).toBeNull();
    expect(
      await prisma.user.findUnique({ where: { id: linked.id } }),
    ).toMatchObject({ clerkUserId: subject });
  });
});
