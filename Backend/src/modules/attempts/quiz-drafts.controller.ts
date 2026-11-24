import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { uuidSchema } from '../../common/http/request.schemas.js';
import { ApiEndpoint } from '../../openapi/api-endpoint.decorator.js';
import {
  QuizDraftsService,
  type DraftSnapshot,
} from './quiz-drafts.service.js';
export const draftSubmitSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
});
export const draftSnapshotSchema = draftSubmitSchema.extend({
  answers: z
    .array(
      z.strictObject({
        questionId: uuidSchema,
        selectedOptionIds: z.array(uuidSchema).max(10),
      }),
    )
    .max(100),
  currentQuestionId: uuidSchema.nullable(),
});
@ApiTags('Quiz drafts')
@ApiBearerAuth('bearerAuth')
@Controller()
export class QuizDraftsController {
  constructor(private readonly drafts: QuizDraftsService) {}
  @Post('quizzes/:quizId/drafts')
  @HttpCode(200)
  @ApiEndpoint({
    id: 'getOrCreateQuizDraft',
    summary: 'Resume or start a personal quiz draft',
    params: ['quizId'],
    status: 200,
    response: 'QuizDraft',
    errors: [404],
  })
  start(
    @CurrentUser('id') userId: string,
    @Param('quizId', { schema: uuidSchema }) id: string,
  ) {
    return this.drafts.getOrCreate(userId, id);
  }
  @Get('quiz-drafts/:draftId')
  @ApiEndpoint({
    id: 'getQuizDraft',
    summary: 'Read a personal quiz draft',
    params: ['draftId'],
    response: 'QuizDraft',
    errors: [404],
  })
  get(
    @CurrentUser('id') userId: string,
    @Param('draftId', { schema: uuidSchema }) id: string,
  ) {
    return this.drafts.get(userId, id);
  }
  @Put('quiz-drafts/:draftId')
  @ApiEndpoint({
    id: 'saveQuizDraft',
    summary: 'Replace a draft snapshot using its current revision',
    params: ['draftId'],
    body: draftSnapshotSchema,
    response: 'QuizDraft',
    errors: [404, 409],
  })
  save(
    @CurrentUser('id') userId: string,
    @Param('draftId', { schema: uuidSchema }) id: string,
    @Body({ schema: draftSnapshotSchema }) body: DraftSnapshot,
  ) {
    return this.drafts.save(userId, id, body);
  }
  @Post('quiz-drafts/:draftId/submit')
  @HttpCode(200)
  @ApiEndpoint({
    id: 'submitQuizDraft',
    summary:
      'Atomically grade a draft; repeat submissions return the same result',
    params: ['draftId'],
    body: draftSubmitSchema,
    status: 200,
    response: 'AttemptResult',
    errors: [404, 409],
  })
  submit(
    @CurrentUser('id') userId: string,
    @Param('draftId', { schema: uuidSchema }) id: string,
    @Body({ schema: draftSubmitSchema }) body: { revision: number },
  ) {
    return this.drafts.submit(userId, id, body.revision);
  }
}
