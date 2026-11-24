import {
  QuizDraftsService,
  draftResponse,
  validateDraftSnapshot,
} from './quiz-drafts.service.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/index.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { QuizzesRepository } from '../quizzes/quizzes.repository.js';
import type { AttemptsService } from './attempts.service.js';
const questions = [
  {
    id: 'q',
    questionType: 'SINGLE_CHOICE',
    options: [{ id: 'a' }, { id: 'b' }],
  },
  {
    id: 'multi',
    questionType: 'MULTI_SELECT',
    options: [{ id: 'c' }, { id: 'd' }],
  },
];
describe('draft snapshot validation', () => {
  it('supports partial, empty, and multi-select snapshots', () => {
    expect(() =>
      validateDraftSnapshot(
        { revision: 0, answers: [], currentQuestionId: null },
        questions,
      ),
    ).not.toThrow();
    expect(() =>
      validateDraftSnapshot(
        {
          revision: 1,
          answers: [
            { questionId: 'q', selectedOptionIds: [] },
            { questionId: 'multi', selectedOptionIds: ['c', 'd'] },
          ],
          currentQuestionId: 'q',
        },
        questions,
      ),
    ).not.toThrow();
  });
  it.each([
    [{ questionId: 'other', selectedOptionIds: ['a'] }],
    [{ questionId: 'q', selectedOptionIds: ['c'] }],
    [{ questionId: 'q', selectedOptionIds: ['a', 'b'] }],
    [{ questionId: 'multi', selectedOptionIds: ['c', 'c'] }],
    [
      { questionId: 'q', selectedOptionIds: ['a'] },
      { questionId: 'q', selectedOptionIds: [] },
    ],
  ])('rejects malformed selections %j', (...answers) => {
    expect(() =>
      validateDraftSnapshot(
        { revision: 0, answers, currentQuestionId: null },
        questions,
      ),
    ).toThrow(ValidationError);
  });
  it('rejects unrelated navigation question', () =>
    expect(() =>
      validateDraftSnapshot(
        { revision: 0, answers: [], currentQuestionId: 'other' },
        questions,
      ),
    ).toThrow(ValidationError));
});
describe('QuizDraftsService concurrency and ownership', () => {
  const row = {
    id: 'draft',
    userId: 'user',
    quizId: 'quiz',
    revision: 2,
    answersJson: [{ questionId: 'q', selectedOptionIds: ['a'] }],
    currentQuestionId: 'q',
    submittedAttemptId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  let tx: any, quizzes: any, attempts: any, service: QuizDraftsService;
  beforeEach(() => {
    tx = {
      $queryRaw: vi.fn(),
      quizDraft: {
        findFirst: vi.fn().mockResolvedValue({ ...row }),
        update: vi.fn().mockImplementation(({ data }: any) => ({
          ...row,
          ...data,
          revision: 3,
        })),
      },
    };
    const prisma = { $transaction: vi.fn((work: any) => work(tx)) };
    quizzes = { findOwnedForTaking: vi.fn().mockResolvedValue({ questions }) };
    attempts = {
      submit: vi.fn().mockResolvedValue({ id: 'attempt', answers: [] }),
      getResult: vi.fn().mockResolvedValue({ id: 'attempt' }),
    };
    service = new QuizDraftsService(
      prisma as unknown as PrismaService,
      quizzes as QuizzesRepository,
      attempts as AttemptsService,
    );
  });
  it('retries when a concurrent submission closes the active draft before reading', async () => {
    const prisma = {
      $executeRaw: vi.fn(),
      quizDraft: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(row),
      },
    };
    const starts = new QuizDraftsService(
      prisma as unknown as PrismaService,
      quizzes as QuizzesRepository,
      attempts as AttemptsService,
    );
    expect((await starts.getOrCreate('user', 'quiz')).id).toBe('draft');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
  });
  it('rejects stale snapshots without writing', async () => {
    await expect(
      service.save('user', 'draft', {
        revision: 1,
        answers: [],
        currentQuestionId: null,
      }),
    ).rejects.toThrow(ConflictError);
    expect(tx.quizDraft.update).not.toHaveBeenCalled();
  });
  it('locks before checking revision and atomically links the graded attempt', async () => {
    await service.submit('user', 'draft', 2);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(attempts.submit).toHaveBeenCalledWith(
      'user',
      'quiz',
      { answers: row.answersJson },
      tx,
    );
    expect(tx.quizDraft.update).toHaveBeenCalledWith({
      where: { id: 'draft' },
      data: { submittedAttemptId: 'attempt', revision: { increment: 1 } },
    });
  });
  it('returns existing submission despite stale revision without grading again', async () => {
    tx.quizDraft.findFirst.mockResolvedValue({
      ...row,
      submittedAttemptId: 'attempt',
    });
    expect(await service.submit('user', 'draft', 0)).toEqual({ id: 'attempt' });
    expect(attempts.submit).not.toHaveBeenCalled();
  });
  it('returns 404 for non-owned drafts before grading', async () => {
    tx.quizDraft.findFirst.mockResolvedValue(null);
    await expect(service.submit('stranger', 'draft', 2)).rejects.toThrow(
      NotFoundError,
    );
    expect(tx.quizDraft.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'draft',
        userId: 'stranger',
        quiz: { material: { workspace: { ownerUserId: 'stranger' } } },
      },
    });
  });
  it('serializes only selections and draft metadata', () => {
    const response = draftResponse(row);
    expect(response.answers).toEqual(row.answersJson);
    expect(response).not.toHaveProperty('answersJson');
    expect(JSON.stringify(response)).not.toMatch(
      /isCorrect|explanation|correctOption/,
    );
  });
});
