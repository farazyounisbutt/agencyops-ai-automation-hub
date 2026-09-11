import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Client archive (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const workspaces: { id: string; slug: string }[] = [];
  const path = (id: string, index = 0) =>
    `/api/workspaces/${workspaces[index]!.slug}/clients/${id}`;
  const create = (status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' = 'ACTIVE') =>
    prisma.client.create({
      data: {
        workspaceId: workspaces[0]!.id,
        name: 'Original',
        slug: `archive-${randomUUID()}`,
        website: 'https://original.example',
        timezone: 'Asia/Karachi',
        status,
        createdAt: new Date('2020-01-01T00:00:00Z'),
        updatedAt: new Date('2020-01-01T00:00:00Z'),
      },
    });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    for (let i = 0; i < 2; i++)
      workspaces.push(
        await prisma.workspace.create({
          data: { name: 'Archive test', slug: `archive-test-${randomUUID()}` },
        }),
      );
  });
  afterAll(async () => {
    try {
      if (prisma && workspaces.length)
        await prisma.workspace.deleteMany({
          where: { id: { in: workspaces.map((w) => w.id) } },
        });
    } finally {
      await app?.close();
    }
  });
  it.each(['ACTIVE', 'INACTIVE'] as const)(
    'archives %s, advances updatedAt once, and preserves other fields',
    async (status) => {
      const client = await create(status);
      const first = await request(app.getHttpServer())
        .post(`${path(client.id)}/archive`)
        .expect(200);
      expect(first.body).toEqual({
        ...client,
        status: 'ARCHIVED',
        createdAt: client.createdAt.toISOString(),
        updatedAt: expect.any(String),
      });
      expect(new Date(first.body.updatedAt).getTime()).toBeGreaterThan(
        client.updatedAt.getTime(),
      );
      await request(app.getHttpServer())
        .post(`${path(client.id)}/archive`)
        .send({})
        .expect(200, first.body);
      const stored = await prisma.client.findUniqueOrThrow({
        where: { id: client.id },
      });
      expect(JSON.parse(JSON.stringify(stored))).toEqual(first.body);
      await request(app.getHttpServer())
        .get(path(client.id))
        .expect(200, first.body);
      const list = await request(app.getHttpServer())
        .get(`/api/workspaces/${workspaces[0]!.slug}/clients`)
        .expect(200);
      expect(list.body).toContainEqual(first.body);
      const edited = await request(app.getHttpServer())
        .patch(path(client.id))
        .send({ name: 'Edited archived client' })
        .expect(200);
      expect(edited.body).toMatchObject({
        name: 'Edited archived client',
        status: 'ARCHIVED',
      });
    },
  );
  it('returns an already archived client without rewriting it', async () => {
    const client = await create('ARCHIVED');
    await request(app.getHttpServer())
      .post(`${path(client.id)}/archive`)
      .send({})
      .expect(200, JSON.parse(JSON.stringify(client)));
    expect(
      await prisma.client.findUniqueOrThrow({ where: { id: client.id } }),
    ).toEqual(client);
  });
  it('concurrent archive requests share one effective transition and timestamp', async () => {
    const client = await create();
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app.getHttpServer()).post(`${path(client.id)}/archive`),
      ),
    );
    const stored = await prisma.client.findUniqueOrThrow({
      where: { id: client.id },
    });
    expect(stored.status).toBe('ARCHIVED');
    expect(stored.updatedAt.getTime()).toBeGreaterThan(
      client.updatedAt.getTime(),
    );
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.body).toEqual(JSON.parse(JSON.stringify(stored)));
    }
    // xmin identifies the PostgreSQL row version; a repeated archive must not
    // create a new version even if a timestamp happened to have the same value.
    const version = () =>
      prisma.$queryRaw<
        { version: string }[]
      >`SELECT xmin::text AS version FROM "Client" WHERE id = ${client.id}::uuid`;
    const before = await version();
    await Promise.all(
      Array.from({ length: 3 }, () =>
        request(app.getHttpServer())
          .post(`${path(client.id)}/archive`)
          .expect(200),
      ),
    );
    expect(await version()).toEqual(before);
  });
  it('rejects properties and non-object JSON without changing the client', async () => {
    const client = await create();
    for (const body of [
      null,
      [],
      'text',
      123,
      false,
      ...[
        'status',
        'name',
        'slug',
        'website',
        'timezone',
        'id',
        'workspaceId',
        'createdAt',
        'updatedAt',
        'extra',
      ].map((key) => ({ [key]: 'forbidden' })),
    ]) {
      await request(app.getHttpServer())
        .post(`${path(client.id)}/archive`)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(body))
        .expect(400);
    }
    expect(
      await prisma.client.findUniqueOrThrow({ where: { id: client.id } }),
    ).toEqual(client);
  });
  it('returns 404 for missing workspace, invalid UUID, missing and out-of-workspace clients', async () => {
    const client = await create();
    for (const url of [
      path('not-a-uuid'),
      path(randomUUID()),
      path(client.id, 1),
      `/api/workspaces/missing-${randomUUID()}/clients/${client.id}`,
    ]) {
      await request(app.getHttpServer()).post(`${url}/archive`).expect(404);
    }
    expect(
      await prisma.client.findUniqueOrThrow({ where: { id: client.id } }),
    ).toEqual(client);
  });
});
