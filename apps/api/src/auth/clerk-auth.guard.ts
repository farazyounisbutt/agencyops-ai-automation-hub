import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { ClerkVerifier } from './clerk-verifier.service.js';
import { CurrentUserService } from './current-user.service.js';

export type AuthenticatedRequest = Request & {
  currentUser: Awaited<ReturnType<CurrentUserService['find']>>;
};

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly verifier: ClerkVerifier,
    private readonly users: CurrentUserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const subject = await this.verifier.verify(request.headers.authorization);
    request.currentUser = await this.users.find(subject);
    return true;
  }
}
