import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

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
