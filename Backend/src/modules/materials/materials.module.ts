import { Module } from '@nestjs/common';
import { ProcessingJobsModule } from '../processing-jobs/processing-jobs.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { MaterialsRepository } from './materials.repository.js';
import { MaterialsService } from './materials.service.js';
import { MaterialsController } from './materials.controller.js';

@Module({
  imports: [WorkspacesModule, ProcessingJobsModule],
  providers: [MaterialsRepository, MaterialsService],
  controllers: [MaterialsController],
  exports: [MaterialsRepository, MaterialsService],
})
export class MaterialsModule {}
