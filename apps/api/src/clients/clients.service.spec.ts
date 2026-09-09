import { NotFoundException } from '@nestjs/common';
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
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      workspace: { findUnique: vi.fn().mockResolvedValue({ id: workspaceId }) },
      client: { findMany: vi.fn(), findFirst: vi.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [ClientsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ClientsService);
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
