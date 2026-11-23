import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiEndpoint } from '../../openapi/api-endpoint.decorator.js';
import { uuidSchema } from '../../common/http/request.schemas.js';
import { ProcessingJobsService } from './processing-jobs.service.js';

@ApiTags('Processing jobs')
@ApiBearerAuth('bearerAuth')
@Controller('materials/:materialId/jobs')
export class ProcessingJobsController {
  constructor(private readonly jobs: ProcessingJobsService) {}

  @Get()
  @ApiEndpoint({
    id: 'listMaterialJobs',
    summary: 'Read processing jobs for an owned material',
    params: ['materialId'],
    response: 'ProcessingJob',
    array: true,
    errors: [404],
  })
  list(
    @CurrentUser('id') userId: string,
    @Param('materialId', { schema: uuidSchema }) id: string,
  ) {
    return this.jobs.listForMaterial(userId, id);
  }
}
