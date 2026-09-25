import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CurrentUserService {
  constructor(private readonly prisma: PrismaService) {}

  async find(clerkUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new ForbiddenException('Account is not provisioned');
    return user;
  }
}
