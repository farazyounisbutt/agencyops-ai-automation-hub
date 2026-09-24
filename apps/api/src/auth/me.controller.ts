import { Controller, Get, Header, Req, UseGuards } from '@nestjs/common';
import {
  ClerkAuthGuard,
  type AuthenticatedRequest,
} from './clerk-auth.guard.js';

@Controller('me')
export class MeController {
  @Get()
  @Header('Cache-Control', 'no-store')
  @UseGuards(ClerkAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return request.currentUser;
  }
}
