import { Module } from '@nestjs/common';
import { ProgressRepository } from './progress.repository.js';
import { ProgressService } from './progress.service.js';
import { ProgressController } from './progress.controller.js';

@Module({
  providers: [ProgressRepository, ProgressService],
  controllers: [ProgressController],
  exports: [ProgressRepository, ProgressService],
})
export class ProgressModule {}
