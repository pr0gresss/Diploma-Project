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
  guideContentSchema,
  guideInputSchema,
  pageSchema,
  renameSchema,
  uuidSchema,
  type GuideBody,
  type GuideContentBody,
  type ListQuery,
  type RenameBody,
} from '../../common/http/request.schemas.js';
import { StudyGuidesService } from './study-guides.service.js';

@ApiTags('Study guides')
@ApiBearerAuth('bearerAuth')
@Controller()
export class StudyGuidesController {
  constructor(private readonly guides: StudyGuidesService) {}

  @Get('materials/:materialId/study-guides')
  @ApiEndpoint({
    id: 'listStudyGuides',
    summary: 'List study guides for an owned material',
    params: ['materialId'],
    query: pageSchema,
    response: 'StudyGuidePage',
    errors: [404],
  })
  list(
    @CurrentUser('id') userId: string,
    @Param('materialId', { schema: uuidSchema }) id: string,
    @Query({ schema: pageSchema }) query: ListQuery,
  ) {
    return this.guides.list(userId, id, query);
  }

  @Post('materials/:materialId/study-guides')
  @ApiEndpoint({
    id: 'createStudyGuide',
    summary: 'Store a Markdown guide for a ready material',
    description:
      'Persists supplied Markdown, maximum 5 MiB. This does not call an AI provider. Material must be READY.',
    params: ['materialId'],
    body: guideInputSchema,
    response: 'StudyGuide',
    status: 201,
    errors: [404, 409, 503],
    example: {
      displayName: 'Transactions',
      content: '# Transactions\n\nTransactions are atomic.',
    },
  })
  create(
    @CurrentUser('id') userId: string,
    @Param('materialId', { schema: uuidSchema }) id: string,
    @Body({ schema: guideInputSchema }) body: GuideBody,
  ) {
    return this.guides.create(userId, id, body);
  }

  @Get('study-guides/:guideId')
  @ApiEndpoint({
    id: 'getStudyGuide',
    summary: 'Read a study guide including its Markdown content',
    params: ['guideId'],
    response: 'StudyGuideContent',
    errors: [404, 503],
  })
  get(
    @CurrentUser('id') userId: string,
    @Param('guideId', { schema: uuidSchema }) id: string,
  ) {
    return this.guides.get(userId, id);
  }

  @Patch('study-guides/:guideId')
  @ApiEndpoint({
    id: 'renameStudyGuide',
    summary: 'Rename a study guide',
    params: ['guideId'],
    body: renameSchema,
    example: { displayName: 'Updated study guide' },
    response: 'StudyGuide',
    errors: [404],
  })
  rename(
    @CurrentUser('id') userId: string,
    @Param('guideId', { schema: uuidSchema }) id: string,
    @Body({ schema: renameSchema }) body: RenameBody,
  ) {
    return this.guides.rename(userId, id, body);
  }

  @Patch('study-guides/:guideId/content')
  @ApiEndpoint({
    id: 'updateStudyGuideContent',
    summary: 'Replace the Markdown content of a study guide',
    params: ['guideId'],
    body: guideContentSchema,
    response: 'StudyGuide',
    errors: [404],
  })
  updateContent(
    @CurrentUser('id') userId: string,
    @Param('guideId', { schema: uuidSchema }) id: string,
    @Body({ schema: guideContentSchema }) body: GuideContentBody,
  ) {
    return this.guides.updateContent(userId, id, body);
  }

  @Delete('study-guides/:guideId')
  @HttpCode(204)
  @ApiEndpoint({
    id: 'deleteStudyGuide',
    summary: 'Delete a guide and clean up its private object',
    params: ['guideId'],
    status: 204,
    errors: [404],
  })
  delete(
    @CurrentUser('id') userId: string,
    @Param('guideId', { schema: uuidSchema }) id: string,
  ) {
    return this.guides.delete(userId, id);
  }
}
