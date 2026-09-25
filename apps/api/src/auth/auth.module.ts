import { Module } from '@nestjs/common';
import { ClerkVerifier } from './clerk-verifier.service.js';
import { ClerkAuthGuard } from './clerk-auth.guard.js';
import { CurrentUserService } from './current-user.service.js';
import { MeController } from './me.controller.js';

@Module({
  controllers: [MeController],
  providers: [ClerkVerifier, ClerkAuthGuard, CurrentUserService],
})
export class AuthModule {}
