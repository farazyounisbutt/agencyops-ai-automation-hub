import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ClientsService } from './clients.service.js';

@Controller('workspaces/:workspaceSlug/clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll(@Param('workspaceSlug') workspaceSlug: string) {
    return this.clientsService.findAll(workspaceSlug);
  }

  @Get(':clientId')
  findOne(
    @Param('workspaceSlug') workspaceSlug: string,
    @Param(
      'clientId',
      new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND }),
    )
    clientId: string,
  ) {
    return this.clientsService.findOne(workspaceSlug, clientId);
  }
}
