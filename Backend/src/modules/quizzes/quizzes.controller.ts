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
  quizInputSchema,
  renameSchema,
  uuidSchema,
  type ListQuery,
  type QuizBody,
  type RenameBody,
} from '../../common/http/request.schemas.js';
import { QuizzesService } from './quizzes.service.js';
import { QuizGenerationService } from './quiz-generation.service.js';
import {
  generateQuizSchema,
  type GenerateQuizInput,
} from './quiz-generation.schemas.js';

@ApiTags('Quizzes')
@ApiBearerAuth('bearerAuth')
@Controller()
export class QuizzesController {
  constructor(
    private readonly quizzes: QuizzesService,
    private readonly generation: QuizGenerationService,
  ) {}

  @Post('materials/:materialId/quizzes/generate')
  @ApiEndpoint({
    id: 'generateQuiz',
    summary:
      'Generate a typed quiz using the configured OpenAI-compatible provider',
    description:
      'Requires owned READY extracted text and configured LLM_MODEL/LLM_API_KEY. Uses the LLM_BASE_URL OpenAI-compatible Chat Completions API with JSON mode and local schema validation. LLM_TIMEOUT_MS, LLM_MAX_CONTEXT_CHARS (including instructions/schema), and LLM_MAX_OUTPUT_TOKENS bound requests. Runs synchronously; poll material jobs for status. No automatic retries, provider fallback or partial publication.',
    params: ['materialId'],
    body: generateQuizSchema,
    status: 201,
    response: 'Quiz',
    errors: [403, 404, 409, 503],
    example: {
      questionCount: 6,
      questionTypes: ['SINGLE_CHOICE', 'SELECT', 'MULTI_SELECT'],
    },
  })
  generate(
    @CurrentUser('id') userId: string,
    @Param('materialId', { schema: uuidSchema }) id: string,
    @Body({ schema: generateQuizSchema }) body: GenerateQuizInput,
  ) {
    return this.generation.generate(userId, id, body);
  }

  @Get('materials/:materialId/quizzes')
  @ApiEndpoint({
    id: 'listQuizzes',
    summary: 'List quizzes for an owned material',
    params: ['materialId'],
    query: pageSchema,
    response: 'QuizPage',
    errors: [404],
  })
  list(
    @CurrentUser('id') userId: string,
    @Param('materialId', { schema: uuidSchema }) id: string,
    @Query({ schema: pageSchema }) query: ListQuery,
  ) {
    return this.quizzes.list(userId, id, query);
  }

  @Post('materials/:materialId/quizzes')
  @ApiEndpoint({
    id: 'createQuiz',
    summary: 'Create a complete quiz from supplied questions',
    description:
      'Material must be READY. Requires 1–100 questions with 2–10 options. SINGLE_CHOICE (radio) and SELECT (dropdown) need exactly one correct option. MULTI_SELECT (checkboxes) needs at least one correct option and uses exact-set grading. Omitted questionType defaults to SINGLE_CHOICE.',
    params: ['materialId'],
    body: quizInputSchema,
    status: 201,
    response: 'Quiz',
    errors: [404, 409],
    example: {
      displayName: 'Transactions quiz',
      questions: [
        {
          prompt: 'Are transactions atomic?',
          explanation: 'All changes commit together or roll back.',
          options: [
            { text: 'Yes', isCorrect: true },
            { text: 'No', isCorrect: false },
          ],
        },
      ],
    },
  })
  create(
    @CurrentUser('id') userId: string,
    @Param('materialId', { schema: uuidSchema }) id: string,
    @Body({ schema: quizInputSchema }) body: QuizBody,
  ) {
    return this.quizzes.create(userId, id, body);
  }

  @Get('quizzes/:quizId')
  @ApiEndpoint({
    id: 'getQuizForTaking',
    summary: 'Read quiz questions without correct answers',
    description:
      'Correctness flags and explanations are omitted until an attempt has been submitted.',
    params: ['quizId'],
    response: 'QuizForTaking',
    errors: [404],
  })
  get(
    @CurrentUser('id') userId: string,
    @Param('quizId', { schema: uuidSchema }) id: string,
  ) {
    return this.quizzes.getForTaking(userId, id);
  }

  @Patch('quizzes/:quizId')
  @ApiEndpoint({
    id: 'renameQuiz',
    summary: 'Rename quiz metadata without modifying questions',
    params: ['quizId'],
    body: renameSchema,
    example: { displayName: 'Practice quiz' },
    response: 'Quiz',
    errors: [404],
  })
  rename(
    @CurrentUser('id') userId: string,
    @Param('quizId', { schema: uuidSchema }) id: string,
    @Body({ schema: renameSchema }) body: RenameBody,
  ) {
    return this.quizzes.rename(userId, id, body);
  }

  @Delete('quizzes/:quizId')
  @HttpCode(204)
  @ApiEndpoint({
    id: 'deleteQuiz',
    summary: 'Delete a quiz and its submitted attempts',
    params: ['quizId'],
    status: 204,
    errors: [404, 409],
  })
  delete(
    @CurrentUser('id') userId: string,
    @Param('quizId', { schema: uuidSchema }) id: string,
  ) {
    return this.quizzes.delete(userId, id);
  }
}
