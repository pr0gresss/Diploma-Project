import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiEndpoint } from '../../openapi/api-endpoint.decorator.js';
import {
  pageSchema,
  uuidSchema,
  workspaceInputSchema,
  type ListQuery,
  type WorkspaceBody,
} from '../../common/http/request.schemas.js';
import { WorkspacesService } from './workspaces.service.js';

@ApiTags('Workspaces')
@ApiBearerAuth('bearerAuth')
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  @ApiEndpoint({
    id: 'listWorkspaces',
    summary: 'List and search owned workspaces',
    query: pageSchema,
    response: 'WorkspacePage',
  })
  list(
    @CurrentUser('id') userId: string,
    @Query({ schema: pageSchema }) query: ListQuery,
  ) {
    return this.workspaces.list(userId, query);
  }

  @Post()
  @ApiEndpoint({
    id: 'createWorkspace',
    summary: 'Create a workspace',
    body: workspaceInputSchema,
    example: { name: 'Database systems' },
    status: 201,
    response: 'Workspace',
  })
  create(
    @CurrentUser('id') userId: string,
    @Body({ schema: workspaceInputSchema }) body: WorkspaceBody,
  ) {
    return this.workspaces.create(userId, body);
  }

  @Get(':workspaceId')
  @ApiEndpoint({
    id: 'getWorkspace',
    summary: 'Read an owned workspace',
    params: ['workspaceId'],
    response: 'Workspace',
    errors: [404],
  })
  get(
    @CurrentUser('id') userId: string,
    @Param('workspaceId', { schema: uuidSchema }) id: string,
  ) {
    return this.workspaces.get(userId, id);
  }

  @Patch(':workspaceId')
  @ApiEndpoint({
    id: 'renameWorkspace',
    summary: 'Rename an owned workspace',
    params: ['workspaceId'],
    body: workspaceInputSchema,
    example: { name: 'Advanced databases' },
    response: 'Workspace',
    errors: [404],
  })
  rename(
    @CurrentUser('id') userId: string,
    @Param('workspaceId', { schema: uuidSchema }) id: string,
    @Body({ schema: workspaceInputSchema }) body: WorkspaceBody,
  ) {
    return this.workspaces.rename(userId, id, body);
  }

  @Delete(':workspaceId')
  @HttpCode(204)
  @ApiEndpoint({
    id: 'deleteWorkspace',
    summary: 'Delete a workspace without assessment history',
    description:
      'Deletes eligible database resources and then attempts private-object cleanup. Assessment history prevents deletion.',
    params: ['workspaceId'],
    status: 204,
    errors: [404, 409],
  })
  delete(
    @CurrentUser('id') userId: string,
    @Param('workspaceId', { schema: uuidSchema }) id: string,
  ) {
    return this.workspaces.delete(userId, id);
  }
}
