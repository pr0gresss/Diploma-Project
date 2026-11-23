import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiEndpoint } from '../../openapi/api-endpoint.decorator.js';
import {
  attemptInputSchema,
  attemptPageSchema,
  uuidSchema,
  type AttemptBody,
  type ListQuery,
} from '../../common/http/request.schemas.js';
import { AttemptsService } from './attempts.service.js';

@ApiTags('Attempts')
@ApiBearerAuth('bearerAuth')
@Controller()
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Get('me/attempts')
  @ApiEndpoint({
    id: 'listMyAttempts',
    summary: 'List the current user’s attempt history',
    query: attemptPageSchema,
    response: 'AttemptPage',
  })
  listMine(
    @CurrentUser('id') userId: string,
    @Query({ schema: attemptPageSchema }) query: ListQuery,
  ) {
    return this.attempts.listMine(userId, query);
  }

  @Get('quizzes/:quizId/attempts')
  @ApiEndpoint({
    id: 'listQuizAttempts',
    summary: 'List personal attempts for an owned quiz',
    params: ['quizId'],
    query: attemptPageSchema,
    response: 'AttemptPage',
    errors: [404],
  })
  listForQuiz(
    @CurrentUser('id') userId: string,
    @Param('quizId', { schema: uuidSchema }) id: string,
    @Query({ schema: attemptPageSchema }) query: ListQuery,
  ) {
    return this.attempts.listForQuiz(userId, id, query);
  }

  @Post('quizzes/:quizId/attempts')
  @ApiEndpoint({
    id: 'submitQuizAttempt',
    summary: 'Submit answers and receive a server-graded result',
    description:
      'Submit selectedOptionIds for every question: one ID for SINGLE_CHOICE/SELECT, one or more for MULTI_SELECT. Multi-select is correct only when the complete correct set is selected with no extras; order is irrelevant. Legacy selectedOptionId is accepted instead of the array, not alongside it. User ID and score are never accepted. Every submission creates a new attempt; retries are not idempotent.',
    params: ['quizId'],
    body: attemptInputSchema,
    status: 201,
    response: 'AttemptResult',
    errors: [404, 409],
    example: {
      answers: [
        {
          questionId: '11111111-1111-4111-8111-111111111111',
          selectedOptionId: '22222222-2222-4222-8222-222222222222',
        },
      ],
    },
  })
  submit(
    @CurrentUser('id') userId: string,
    @Param('quizId', { schema: uuidSchema }) id: string,
    @Body({ schema: attemptInputSchema }) body: AttemptBody,
  ) {
    return this.attempts.submit(userId, id, body);
  }

  @Get('attempts/:attemptId')
  @ApiEndpoint({
    id: 'getAttemptResult',
    summary: 'Read a personal result including correct answers',
    params: ['attemptId'],
    response: 'AttemptResult',
    errors: [404, 409],
  })
  get(
    @CurrentUser('id') userId: string,
    @Param('attemptId', { schema: uuidSchema }) id: string,
  ) {
    return this.attempts.getResult(userId, id);
  }
}
