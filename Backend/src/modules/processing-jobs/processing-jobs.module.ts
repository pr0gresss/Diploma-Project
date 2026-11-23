import { Module } from '@nestjs/common';
import { ProcessingJobsRepository } from './processing-jobs.repository.js';
import { ProcessingJobsService } from './processing-jobs.service.js';
import { ProcessingJobsController } from './processing-jobs.controller.js';
import { ExtractionWorker } from './extraction.worker.js';

@Module({
  providers: [ProcessingJobsRepository, ProcessingJobsService, ExtractionWorker],
  controllers: [ProcessingJobsController],
  exports: [ProcessingJobsRepository, ProcessingJobsService],
})
export class ProcessingJobsModule {}
