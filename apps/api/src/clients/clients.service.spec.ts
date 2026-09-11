import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClientsService } from './clients.service.js';

describe('ClientsService', () => {
  const workspaceId = '11111111-1111-4111-8111-111111111111';
  const clientId = '22222222-2222-4222-8222-222222222222';
  const client = {
    id: clientId,
    workspaceId,
    name: 'Acme Studio',
    slug: 'acme-studio',
    website: null,
    timezone: 'UTC',
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
  let service: ClientsService;
  let prisma: {
    workspace: { findUnique: ReturnType<typeof vi.fn> };
    client: {
      update: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      workspace: { findUnique: vi.fn().mockResolvedValue({ id: workspaceId }) },
      client: {
        update: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [ClientsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ClientsService);
  });

  it('creates with explicit input fields and URL-resolved ownership', async () => {
    prisma.client.create.mockResolvedValue(client);
    const input = {
      name: client.name,
      slug: client.slug,
      workspaceId: 'injected',
      status: 'ARCHIVED',
    };
    await expect(service.create('agencyops-demo', input)).resolves.toEqual(
      client,
    );
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { slug: 'agencyops-demo' },
      select: { id: true },
    });
    expect(prisma.client.create).toHaveBeenCalledWith({
      data: {
        workspaceId,
        name: client.name,
        slug: client.slug,
        website: undefined,
        timezone: undefined,
      },
    });
  });

  it('does not insert for a missing workspace', async () => {
    prisma.workspace.findUnique.mockResolvedValue(null);
    await expect(
      service.create('missing', { name: 'Acme', slug: 'acme' }),
    ).rejects.toThrow(new NotFoundException('Workspace not found'));
    expect(prisma.client.create).not.toHaveBeenCalled();
  });

  const databaseError = (code: string, meta?: Record<string, unknown>) =>
    new Prisma.PrismaClientKnownRequestError('Database failure', {
      code,
      clientVersion: '7.9.1',
      meta,
    });

  it.each([
    { target: ['workspaceId', 'slug'] },
    {
      driverAdapterError: {
        cause: {
          kind: 'UniqueConstraintViolation',
          constraint: { fields: ['"workspaceId"', 'slug'] },
        },
      },
    },
  ])(
    'translates only the Client workspace/slug uniqueness violation: %j',
    async (meta) => {
      prisma.client.create.mockRejectedValue(
        databaseError('P2002', {
          modelName: 'Client',
          ...meta,
        }),
      );
      await expect(
        service.create('agencyops-demo', { name: 'Acme', slug: 'acme' }),
      ).rejects.toThrow(ConflictException);
    },
  );

  it.each([
    databaseError('P2002', { modelName: 'Client', target: ['id'] }),
    databaseError('P2002', { modelName: 'Workspace', target: ['slug'] }),
    databaseError('P2002'),
    databaseError('P2002', {
      modelName: 'Client',
      driverAdapterError: {
        cause: {
          kind: 'UniqueConstraintViolation',
          constraint: { fields: ['id'] },
        },
      },
    }),
    databaseError('P2002', {
      modelName: 'Client',
      driverAdapterError: {
        cause: {
          kind: 'UniqueConstraintViolation',
          constraint: { index: 'Client_pkey' },
        },
      },
    }),
    databaseError('P2003', {
      modelName: 'Client',
      target: ['workspaceId', 'slug'],
    }),
    new Error('Connection failure'),
  ])('preserves unrelated database errors: %s', async (error) => {
    prisma.client.create.mockRejectedValue(error);
    await expect(
      service.create('agencyops-demo', { name: 'Acme', slug: 'acme' }),
    ).rejects.toBe(error);
  });

  it.each([
    { name: 'New' },
    { slug: 'new' },
    { website: null },
    { timezone: 'Asia/Karachi' },
    {
      name: 'New',
      slug: 'new',
      website: 'https://example.com',
      timezone: 'UTC',
    },
  ])(
    'updates only supplied fields with scoped ownership: %j',
    async (input) => {
      prisma.client.update.mockResolvedValue({ ...client, ...input });
      await expect(
        service.update('agencyops-demo', clientId, {
          ...input,
          workspaceId: 'injected',
          status: 'ARCHIVED',
        } as typeof input),
      ).resolves.toEqual({ ...client, ...input });
      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: clientId, workspaceId },
        data: input,
      });
    },
  );
  it('rejects empty updates before accessing the database', async () => {
    await expect(
      service.update('agencyops-demo', clientId, {}),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.workspace.findUnique).not.toHaveBeenCalled();
    expect(prisma.client.update).not.toHaveBeenCalled();
  });
  it('does not update for a missing workspace', async () => {
    prisma.workspace.findUnique.mockResolvedValue(null);
    await expect(
      service.update('missing', clientId, { name: 'New' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.client.update).not.toHaveBeenCalled();
  });
  it('maps a scoped update with no matching client to 404', async () => {
    prisma.client.update.mockRejectedValue(databaseError('P2025'));
    await expect(
      service.update('agencyops-demo', clientId, { name: 'New' }),
    ).rejects.toThrow(NotFoundException);
  });
  it.each([
    { target: ['workspaceId', 'slug'] },
    {
      driverAdapterError: {
        cause: {
          kind: 'UniqueConstraintViolation',
          constraint: { fields: ['"workspaceId"', 'slug'] },
        },
      },
    },
  ])('maps update workspace/slug conflicts: %j', async (meta) => {
    prisma.client.update.mockRejectedValue(
      databaseError('P2002', { modelName: 'Client', ...meta }),
    );
    await expect(
      service.update('agencyops-demo', clientId, { slug: 'taken' }),
    ).rejects.toThrow(ConflictException);
  });
  it.each([
    databaseError('P2002', { modelName: 'Client', target: ['id'] }),
    databaseError('P2002', { modelName: 'Workspace', target: ['slug'] }),
    databaseError('P2002'),
    databaseError('P2003'),
    new Error('Connection failure'),
  ])('preserves unrelated update errors: %s', async (error) => {
    prisma.client.update.mockRejectedValue(error);
    await expect(
      service.update('agencyops-demo', clientId, { slug: 'new' }),
    ).rejects.toBe(error);
  });

  it('lists all workspace clients ordered by name', async () => {
    const clients = [
      client,
      { ...client, id: 'other-id', name: 'Northstar Labs' },
    ];
    prisma.client.findMany.mockResolvedValue(clients);
    await expect(service.findAll('agencyops-demo')).resolves.toEqual(clients);
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { slug: 'agencyops-demo' },
      select: { id: true },
    });
    expect(prisma.client.findMany).toHaveBeenCalledWith({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });
  });

  it('returns an empty list for a workspace without clients', async () => {
    prisma.client.findMany.mockResolvedValue([]);
    await expect(service.findAll('agencyops-demo')).resolves.toEqual([]);
  });

  it.each(['list', 'lookup'])(
    'returns 404 for a missing workspace during %s',
    async (operation) => {
      prisma.workspace.findUnique.mockResolvedValue(null);
      await expect(
        operation === 'list'
          ? service.findAll('missing')
          : service.findOne('missing', clientId),
      ).rejects.toThrow(new NotFoundException('Workspace not found'));
      expect(prisma.client.findMany).not.toHaveBeenCalled();
      expect(prisma.client.findFirst).not.toHaveBeenCalled();
    },
  );

  it('looks up a client within the requested workspace', async () => {
    prisma.client.findFirst.mockResolvedValue(client);
    await expect(service.findOne('agencyops-demo', clientId)).resolves.toEqual(
      client,
    );
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { slug: 'agencyops-demo' },
      select: { id: true },
    });
    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: clientId, workspaceId },
    });
  });

  it('returns 404 for a missing client', async () => {
    prisma.client.findFirst.mockResolvedValue(null);
    await expect(service.findOne('agencyops-demo', clientId)).rejects.toThrow(
      new NotFoundException('Client not found'),
    );
  });

  it('returns 404 when the client belongs to another workspace', async () => {
    const otherWorkspaceId = '33333333-3333-4333-8333-333333333333';
    prisma.workspace.findUnique.mockResolvedValue({ id: otherWorkspaceId });
    prisma.client.findFirst.mockImplementation(async ({ where }) =>
      where.id === client.id && where.workspaceId === client.workspaceId
        ? client
        : null,
    );
    await expect(service.findOne('other-workspace', clientId)).rejects.toThrow(
      new NotFoundException('Client not found'),
    );
    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: clientId, workspaceId: otherWorkspaceId },
    });
  });
});
