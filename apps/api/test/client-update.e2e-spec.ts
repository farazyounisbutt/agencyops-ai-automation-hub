import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Client update (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const workspaces: { id: string; slug: string }[] = [];
  const path = (id: string, index = 0) =>
    `/api/workspaces/${workspaces[index]!.slug}/clients/${id}`;
  const create = (index = 0) =>
    prisma.client.create({
      data: {
        workspaceId: workspaces[index]!.id,
        name: 'Original',
        slug: `client-${randomUUID()}`,
        website: 'https://original.example',
        timezone: 'Asia/Karachi',
        status: 'ARCHIVED',
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
    for (let i = 0; i < 2; i++) {
      workspaces.push(
        await prisma.workspace.create({
          data: { name: 'Update test', slug: `update-test-${randomUUID()}` },
        }),
      );
    }
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
  it.each([
    { name: 'Changed' },
    { slug: 'changed' },
    { website: 'http://localhost' },
    { timezone: 'UTC' },
    { website: null },
    { name: 'Changed', slug: 'combined', website: null, timezone: 'UTC' },
  ])(
    'persists individual/combined updates and preserves omissions: %j',
    async (input) => {
      const client = await create();
      const response = await request(app.getHttpServer())
        .patch(path(client.id))
        .send(input)
        .expect(200);
      expect(response.body).toEqual({
        ...client,
        ...input,
        createdAt: client.createdAt.toISOString(),
        updatedAt: expect.any(String),
      });
      const stored = await prisma.client.findUniqueOrThrow({
        where: { id: client.id },
      });
      expect(JSON.parse(JSON.stringify(stored))).toEqual(response.body);
      await request(app.getHttpServer())
        .get(path(client.id))
        .expect(200, response.body);
    },
  );
  it('trims names and accepts maximum name and slug lengths', async () => {
    const client = await create();
    const response = await request(app.getHttpServer())
      .patch(path(client.id))
      .send({ name: `  ${'a'.repeat(200)}  `, slug: 'a'.repeat(100) })
      .expect(200);
    expect(response.body.name).toBe('a'.repeat(200));
  });
  it('rejects invalid, empty, non-object, unknown and protected bodies without mutation', async () => {
    const client = await create();
    for (const input of [
      {},
      [],
      'text',
      123,
      null,
      { name: null },
      { slug: null },
      { timezone: null },
      { name: ' ' },
      { name: 'a'.repeat(201) },
      { slug: 'a'.repeat(101) },
      { slug: 'UPPER' },
      { slug: 'end\n' },
      { slug: 'a--b' },
      { website: '' },
      { website: 'ftp://example.com' },
      { timezone: '+05:00' },
      { timezone: 'Not/AZone' },
      ...['id', 'workspaceId', 'status', 'createdAt', 'updatedAt', 'extra'].map(
        (key) => ({ name: 'Changed', [key]: 'forbidden' }),
      ),
    ]) {
      await request(app.getHttpServer())
        .patch(path(client.id))
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(input))
        .expect(400);
    }
    await request(app.getHttpServer()).patch(path(client.id)).expect(400);
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
      await request(app.getHttpServer())
        .patch(url)
        .send({ name: 'Changed' })
        .expect(404);
    }
    expect(
      await prisma.client.findUniqueOrThrow({ where: { id: client.id } }),
    ).toEqual(client);
  });
  it('accepts unchanged slug and cross-workspace reuse; rejects duplicate slug atomically', async () => {
    const client = await create();
    const other = await create();
    const external = await create(1);
    await request(app.getHttpServer())
      .patch(path(client.id))
      .send({ slug: client.slug })
      .expect(200);
    await request(app.getHttpServer())
      .patch(path(client.id))
      .send({ slug: external.slug })
      .expect(200);
    const before = await prisma.client.findUniqueOrThrow({
      where: { id: client.id },
    });
    await request(app.getHttpServer())
      .patch(path(client.id))
      .send({ name: 'Must not change', slug: other.slug })
      .expect(409);
    expect(
      await prisma.client.findUniqueOrThrow({ where: { id: client.id } }),
    ).toEqual(before);
  });
  it('returns one success and one conflict for concurrent competing slug updates', async () => {
    const clients = await Promise.all([create(), create()]);
    const slug = `contended-${randomUUID()}`;
    const responses = await Promise.all(
      clients.map((client) =>
        request(app.getHttpServer()).patch(path(client.id)).send({ slug }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await prisma.client.count({
        where: { workspaceId: workspaces[0]!.id, slug },
      }),
    ).toBe(1);
  });
});
