import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Client creation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const workspaceIds: string[] = [];
  const workspaceSlugs = [0, 1].map(() => `client-create-test-${randomUUID()}`);
  const path = (index = 0) =>
    `/api/workspaces/${workspaceSlugs[index]}/clients`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    for (const slug of workspaceSlugs) {
      const workspace = await prisma.workspace.create({
        data: { name: 'Client creation test', slug },
      });
      workspaceIds.push(workspace.id);
    }
  });

  afterAll(async () => {
    try {
      // Delete only the exact workspaces created by this suite; clients cascade.
      if (prisma && workspaceIds.length) {
        await prisma.workspace.deleteMany({
          where: { id: { in: workspaceIds } },
        });
      }
    } finally {
      await app?.close();
    }
  });

  it('creates, persists, and reads a trimmed client with database defaults', async () => {
    const response = await request(app.getHttpServer())
      .post(path())
      .send({ name: '  Acme  ', slug: 'acme' })
      .expect(201);
    expect(response.body).toEqual({
      id: expect.any(String),
      workspaceId: workspaceIds[0],
      name: 'Acme',
      slug: 'acme',
      website: null,
      timezone: 'UTC',
      status: 'ACTIVE',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    const stored = await prisma.client.findUniqueOrThrow({
      where: { id: response.body.id },
    });
    expect(stored.name).toBe('Acme');
    await request(app.getHttpServer())
      .get(`${path()}/${stored.id}`)
      .expect(200, response.body);
    await request(app.getHttpServer())
      .get(`${path(1)}/${stored.id}`)
      .expect(404);
    const list = await request(app.getHttpServer()).get(path()).expect(200);
    expect(list.body).toContainEqual(response.body);
  });

  it('persists optional URL and timezone, and accepts a null website', async () => {
    const input = {
      name: 'Custom',
      slug: 'custom',
      website: 'https://acme.example',
      timezone: 'Asia/Karachi',
    };
    const response = await request(app.getHttpServer())
      .post(path())
      .send(input)
      .expect(201);
    expect(response.body).toMatchObject(input);
    const nullable = await request(app.getHttpServer())
      .post(path())
      .send({ name: 'Null', slug: 'null', website: null })
      .expect(201);
    expect(nullable.body.website).toBeNull();
  });

  it('returns 404 for a missing workspace', async () => {
    await request(app.getHttpServer())
      .post(`/api/workspaces/missing-${randomUUID()}/clients`)
      .send({ name: 'Missing', slug: 'missing' })
      .expect(404);
  });

  it('rejects invalid input and ownership overrides without inserting records', async () => {
    const before = await prisma.client.count({
      where: { workspaceId: { in: workspaceIds } },
    });
    for (const fields of [
      { name: ' ' },
      { slug: 'Invalid' },
      { slug: 'invalid\n' },
      { timezone: null },
      { website: 'ftp://acme.example' },
      { workspaceId: workspaceIds[1] },
      { status: 'ACTIVE' },
      { extra: true },
    ]) {
      await request(app.getHttpServer())
        .post(path())
        .send({ name: 'Invalid', slug: 'invalid', ...fields })
        .expect(400);
    }
    expect(
      await prisma.client.count({
        where: { workspaceId: { in: workspaceIds } },
      }),
    ).toBe(before);
    await request(app.getHttpServer())
      .post(`/api/workspaces/missing-${randomUUID()}/clients`)
      .send({ name: ' ' })
      .expect(400);
  });

  it('rejects duplicates within a workspace but permits the same slug elsewhere', async () => {
    const input = { name: 'Shared', slug: 'shared' };
    await request(app.getHttpServer()).post(path()).send(input).expect(201);
    await request(app.getHttpServer()).post(path()).send(input).expect(409);
    await request(app.getHttpServer()).post(path(1)).send(input).expect(201);
  });

  it('returns one 201 and one 409 for concurrent duplicate requests', async () => {
    const input = { name: 'Concurrent', slug: 'concurrent' };
    const responses = await Promise.all(
      [0, 1].map(() => request(app.getHttpServer()).post(path()).send(input)),
    );
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(
      await prisma.client.count({
        where: { workspaceId: workspaceIds[0], slug: input.slug },
      }),
    ).toBe(1);
  });

  it('preserves read error behavior', async () => {
    await request(app.getHttpServer()).get(`${path()}/not-a-uuid`).expect(404);
    await request(app.getHttpServer())
      .get(`/api/workspaces/missing-${randomUUID()}/clients`)
      .expect(404);
  });
});
