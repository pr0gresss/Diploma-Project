import { z } from 'zod';

const id = z.uuid().describe('Resource identifier (UUID).');
const timestamp = z.iso
  .datetime()
  .describe('UTC timestamp, serialized as ISO 8601.');
const count = z.number().int().nonnegative();
const score = z.number().min(0).max(100);
const text = z.string();
const named = {
  id,
  displayName: text,
  createdAt: timestamp,
  updatedAt: timestamp,
};
export const userResponse = z.object({
  id,
  email: z.email(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export const sessionResponse = z.object({
  user: userResponse,
  accessToken: text.describe('Short-lived JWT access token; keep private.'),
  expiresIn: count.describe('Access token lifetime in seconds.'),
  tokenType: z.literal('Bearer'),
});
export const workspaceResponse = z.object({
  id,
  name: text,
  materialCount: count,
  createdAt: timestamp,
  updatedAt: timestamp,
});
export const jobResponse = z.object({
  id,
  materialId: id,
  jobType: z.enum(['EXTRACT_TEXT', 'GENERATE_GUIDE', 'GENERATE_QUIZ']),
  status: z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED']),
  errorMessage: text.nullable(),
  createdAt: timestamp,
  startedAt: timestamp.nullable(),
  finishedAt: timestamp.nullable(),
});
export const materialResponse = z.object({
  ...named,
  workspaceId: id,
  originalFilename: text,
  mimeType: text,
  sizeBytes: count.describe('Original file size in bytes, maximum 10 MiB.'),
  processingStatus: z.enum(['UPLOADED', 'PROCESSING', 'READY', 'FAILED']),
  jobCount: count,
  guideCount: count,
  quizCount: count,
});
export const materialDetailsResponse = materialResponse.extend({
  processingJobs: z.array(jobResponse),
});
export const guideResponse = z.object({ ...named, materialId: id });
export const guideContentResponse = guideResponse.extend({
  content: text.describe('Private Markdown guide body.'),
});
export const quizResponse = z.object({
  ...named,
  materialId: id,
  questionCount: count,
  attemptCount: count,
  latestAttemptId: id.nullable(),
  latestScorePercent: score.nullable(),
  activeDraft: z
    .object({
      id,
      answeredCount: count,
      totalQuestions: count,
      updatedAt: timestamp,
    })
    .nullable(),
});
export const quizTakingResponse = z.object({
  id,
  materialId: id,
  displayName: text,
  materialDisplayName: text,
  workspaceId: id,
  questions: z.array(
    z.object({
      questionType: z.enum(['SINGLE_CHOICE', 'SELECT', 'MULTI_SELECT']),
      id,
      position: count,
      prompt: text,
      options: z.array(z.object({ id, position: count, text })),
    }),
  ),
});
export const attemptResponse = z.object({
  id,
  quizId: id,
  quizDisplayName: text,
  materialId: id,
  workspaceId: id,
  submittedAt: timestamp,
  totalQuestions: count,
  correctAnswers: count,
  scorePercent: score,
});
export const attemptResultResponse = attemptResponse.extend({
  answers: z.array(
    z.object({
      questionId: id,
      questionType: z.enum(['SINGLE_CHOICE', 'SELECT', 'MULTI_SELECT']),
      questionPosition: count,
      prompt: text,
      selectedOptionIds: z.array(id),
      selectedOptionTexts: z.array(text),
      correctOptionIds: z.array(id),
      correctOptionTexts: z.array(text),
      selectedOptionId: id
        .nullable()
        .describe(
          'Legacy alias; null for MULTI_SELECT. Use selectedOptionIds.',
        ),
      selectedOptionText: text
        .nullable()
        .describe('Legacy alias; null for MULTI_SELECT.'),
      correctOptionId: id
        .nullable()
        .describe('Legacy alias; null for MULTI_SELECT. Use correctOptionIds.'),
      correctOptionText: text
        .nullable()
        .describe('Legacy alias; null for MULTI_SELECT.'),
      isCorrect: z.boolean(),
      explanation: text.nullable(),
    }),
  ),
});
export const overviewResponse = z.object({
  totalAttempts: count,
  completedQuizzes: count,
  workspacesStudied: count,
  averageScorePercent: score,
  bestScorePercent: score,
  lastCompletedAt: timestamp.nullable(),
});
export const quizProgressResponse = z.object({
  quizId: id,
  quizDisplayName: text,
  materialId: id,
  materialDisplayName: text,
  workspaceId: id,
  workspaceName: text,
  completedAttempts: count,
  averageScorePercent: score,
  bestScorePercent: score,
  latestScorePercent: score,
  lastCompletedAt: timestamp,
});
export function pageResponse<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: count,
    limit: count,
    offset: count,
  });
}
export const progressResponse = pageResponse(quizProgressResponse).extend({
  overview: overviewResponse,
});

export const resourceSchemas = {
  User: userResponse,
  AuthSession: sessionResponse,
  Workspace: workspaceResponse,
  ProcessingJob: jobResponse,
  Material: materialResponse,
  MaterialDetails: materialDetailsResponse,
  StudyGuide: guideResponse,
  StudyGuideContent: guideContentResponse,
  QuizDraft: z.object({
    id,
    userId: id,
    quizId: id,
    answers: z.array(
      z.object({ questionId: id, selectedOptionIds: z.array(id) }),
    ),
    currentQuestionId: id.nullable(),
    revision: count,
    createdAt: timestamp,
    updatedAt: timestamp,
    submittedAttemptId: id.nullable(),
  }),
  Quiz: quizResponse,
  QuizForTaking: quizTakingResponse,
  Attempt: attemptResponse,
  AttemptResult: attemptResultResponse,
  ProgressOverview: overviewResponse,
  QuizProgress: quizProgressResponse,
  WorkspacePage: pageResponse(workspaceResponse),
  MaterialPage: pageResponse(materialResponse),
  StudyGuidePage: pageResponse(guideResponse),
  QuizPage: pageResponse(quizResponse),
  AttemptPage: pageResponse(attemptResponse),
  ProgressReport: progressResponse,
};
export type ResourceSchemaName = keyof typeof resourceSchemas;
