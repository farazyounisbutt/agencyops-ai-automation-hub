import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { CreateClientDto } from './dto/create-client.dto.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isClientSlugConflict(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002' ||
    error.meta?.modelName !== 'Client'
  ) {
    return false;
  }
  let fields: unknown = error.meta.target;
  // Prisma 7's pg adapter reports constraint fields inside its cause, and
  // PostgreSQL quotes camelCase identifiers in that field list.
  const adapterError = error.meta.driverAdapterError;
  if (isRecord(adapterError) && isRecord(adapterError.cause)) {
    const cause = adapterError.cause;
    if (
      cause.kind === 'UniqueConstraintViolation' &&
      isRecord(cause.constraint)
    ) {
      fields = cause.constraint.fields;
    }
  }
  return (
    Array.isArray(fields) &&
    fields.length === 2 &&
    (fields.includes('workspaceId') || fields.includes('"workspaceId"')) &&
    (fields.includes('slug') || fields.includes('"slug"'))
  );
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceSlug: string, input: CreateClientDto) {
    const workspace = await this.findWorkspace(workspaceSlug);
    try {
      return await this.prisma.client.create({
        data: {
          workspaceId: workspace.id,
          name: input.name,
          slug: input.slug,
          website: input.website,
          timezone: input.timezone,
        },
      });
    } catch (error) {
      if (isClientSlugConflict(error)) {
        throw new ConflictException(
          'Client slug already exists in this workspace',
        );
      }
      throw error;
    }
  }

  async findAll(workspaceSlug: string) {
    const workspace = await this.findWorkspace(workspaceSlug);
    return this.prisma.client.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(workspaceSlug: string, clientId: string) {
    const workspace = await this.findWorkspace(workspaceSlug);
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, workspaceId: workspace.id },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    return client;
  }

  private async findWorkspace(slug: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    return workspace;
  }
}
