import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ClientsService } from './clients.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';

@Controller('workspaces/:workspaceSlug/clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(
    @Param('workspaceSlug') workspaceSlug: string,
    @Body() input: CreateClientDto,
  ) {
    return this.clientsService.create(workspaceSlug, input);
  }

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
