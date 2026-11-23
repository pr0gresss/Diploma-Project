import { Module } from '@nestjs/common';
import { WorkspacesRepository } from './workspaces.repository.js';
import { WorkspacesService } from './workspaces.service.js';
import { WorkspacesController } from './workspaces.controller.js';

@Module({
  providers: [WorkspacesRepository, WorkspacesService],
  controllers: [WorkspacesController],
  exports: [WorkspacesRepository, WorkspacesService],
})
export class WorkspacesModule {}
