import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiEndpoint } from '../../openapi/api-endpoint.decorator.js';
import {
  pageSchema,
  type ListQuery,
} from '../../common/http/request.schemas.js';
import { ProgressService } from './progress.service.js';

@ApiTags('Progress')
@ApiBearerAuth('bearerAuth')
@Controller('me/progress')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get()
  @ApiEndpoint({
    id: 'getMyProgress',
    summary: 'Read personal quiz progress and overall totals',
    description:
      'Rows represent attempted quizzes. Search filters rows by quiz, material or workspace name. Overview totals remain unfiltered across all personal attempts.',
    query: pageSchema,
    response: 'ProgressReport',
  })
  report(
    @CurrentUser('id') userId: string,
    @Query({ schema: pageSchema }) query: ListQuery,
  ) {
    return this.progress.getReport(userId, query);
  }

  @Get('overview')
  @ApiEndpoint({
    id: 'getMyProgressOverview',
    summary: 'Read overall personal study totals',
    description:
      'An account without attempts returns zero totals and null lastCompletedAt.',
    response: 'ProgressOverview',
  })
  overview(@CurrentUser('id') userId: string) {
    return this.progress.getOverview(userId);
  }
}
