import type { ResourceSchemaName } from './resource.schemas.js';

const id = '11111111-1111-4111-8111-111111111111';
const workspaceId = '22222222-2222-4222-8222-222222222222';
const materialId = '33333333-3333-4333-8333-333333333333';
const quizId = '44444444-4444-4444-8444-444444444444';
const questionId = '55555555-5555-4555-8555-555555555555';
const selectedOptionId = '66666666-6666-4666-8666-666666666666';
const dates = {
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
};
const user = { id, email: 'student@example.com', ...dates };
const workspace = {
  id: workspaceId,
  name: 'Database systems',
  materialCount: 1,
  ...dates,
};
const job = {
  id,
  materialId,
  jobType: 'EXTRACT_TEXT',
  status: 'QUEUED',
  errorMessage: null,
  createdAt: dates.createdAt,
  startedAt: null,
  finishedAt: null,
};
const material = {
  id: materialId,
  workspaceId,
  displayName: 'Lecture notes',
  originalFilename: 'lecture.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 248576,
  processingStatus: 'UPLOADED',
  jobCount: 1,
  guideCount: 0,
  quizCount: 0,
  ...dates,
};
const guide = {
  id,
  materialId,
  displayName: 'Transactions study guide',
  ...dates,
};
const quiz = {
  id: quizId,
  materialId,
  displayName: 'Transactions quiz',
  questionCount: 1,
  attemptCount: 0,
  latestAttemptId: null,
  latestScorePercent: null,
  activeDraft: null,
  ...dates,
};
const attempt = {
  id,
  quizId,
  quizDisplayName: quiz.displayName,
  materialId,
  workspaceId,
  submittedAt: dates.createdAt,
  totalQuestions: 1,
  correctAnswers: 1,
  scorePercent: 100,
};
const overview = {
  totalAttempts: 1,
  completedQuizzes: 1,
  workspacesStudied: 1,
  averageScorePercent: 100,
  bestScorePercent: 100,
  lastCompletedAt: dates.createdAt,
};
const progress = {
  quizId,
  quizDisplayName: quiz.displayName,
  materialId,
  materialDisplayName: material.displayName,
  workspaceId,
  workspaceName: workspace.name,
  completedAttempts: 1,
  averageScorePercent: 100,
  bestScorePercent: 100,
  latestScorePercent: 100,
  lastCompletedAt: dates.createdAt,
};
const page = (item: unknown) => ({
  items: [item],
  total: 1,
  limit: 20,
  offset: 0,
});

/** Illustrative UUIDs, not a promise that these objects exist in seed data. */
export const resourceExamples: Record<ResourceSchemaName, unknown> = {
  User: user,
  AuthSession: {
    user,
    accessToken: 'documentation-example-not-a-valid-jwt',
    expiresIn: 900,
    tokenType: 'Bearer',
  },
  Workspace: workspace,
  ProcessingJob: job,
  Material: material,
  MaterialDetails: { ...material, processingJobs: [job] },
  StudyGuide: guide,
  StudyGuideContent: {
    ...guide,
    content: '# Transactions\n\nTransactions are atomic.',
  },
  QuizDraft: {
    id,
    userId: id,
    quizId,
    answers: [],
    currentQuestionId: null,
    revision: 0,
    ...dates,
    submittedAttemptId: null,
  },
  Quiz: quiz,
  QuizForTaking: {
    id: quizId,
    materialId,
    displayName: quiz.displayName,
    materialDisplayName: material.displayName,
    workspaceId,
    questions: [
      {
        questionType: 'SINGLE_CHOICE',
        id: questionId,
        position: 1,
        prompt: 'Are transactions atomic?',
        options: [
          { id: selectedOptionId, position: 1, text: 'Yes' },
          {
            id: '77777777-7777-4777-8777-777777777777',
            position: 2,
            text: 'No',
          },
        ],
      },
    ],
  },
  Attempt: attempt,
  AttemptResult: {
    ...attempt,
    answers: [
      {
        questionId,
        questionType: 'SINGLE_CHOICE',
        selectedOptionIds: [selectedOptionId],
        selectedOptionTexts: ['Yes'],
        correctOptionIds: [selectedOptionId],
        correctOptionTexts: ['Yes'],
        questionPosition: 1,
        prompt: 'Are transactions atomic?',
        selectedOptionId,
        selectedOptionText: 'Yes',
        correctOptionId: selectedOptionId,
        correctOptionText: 'Yes',
        isCorrect: true,
        explanation: 'All changes commit together or roll back.',
      },
    ],
  },
  ProgressOverview: overview,
  QuizProgress: progress,
  WorkspacePage: page(workspace),
  MaterialPage: page(material),
  StudyGuidePage: page(guide),
  QuizPage: page(quiz),
  AttemptPage: page(attempt),
  ProgressReport: { ...page(progress), overview },
};
