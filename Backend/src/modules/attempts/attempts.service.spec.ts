import { AttemptsService } from './attempts.service.js';
import { AttemptsRepository } from './attempts.repository.js';
import { QuizzesRepository } from '../quizzes/quizzes.repository.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/index.js';

describe('AttemptsService', () => {
  const quiz = {
    id: 'quiz',
    materialId: 'material',
    workspaceId: 'workspace',
    displayName: 'Quiz',
    materialDisplayName: 'Material',
    questions: [
      {
        id: 'question',
        position: 1,
        prompt: 'Question?',
        explanation: 'Because',
        options: [
          { id: 'correct', position: 1, optionText: 'Yes', isCorrect: true },
          { id: 'wrong', position: 2, optionText: 'No', isCorrect: false },
        ],
      },
    ],
  };
  let repository: {
    create: ReturnType<typeof vi.fn>;
    findManyByUser: ReturnType<typeof vi.fn>;
    findByIdForUser: ReturnType<typeof vi.fn>;
  };
  let quizzes: {
    findOwnedForGrading: ReturnType<typeof vi.fn>;
    findOwnedById: ReturnType<typeof vi.fn>;
  };
  let service: AttemptsService;

  beforeEach(() => {
    repository = {
      create: vi.fn().mockImplementation(async (data) => ({
        id: 'attempt',
        ...data,
        submittedAt: new Date(),
        scorePercent: data.correctAnswers * 100,
      })),
      findManyByUser: vi.fn(),
      findByIdForUser: vi.fn(),
    };
    quizzes = {
      findOwnedForGrading: vi.fn().mockResolvedValue(quiz),
      findOwnedById: vi.fn().mockResolvedValue({ id: 'quiz' }),
    };
    service = new AttemptsService(
      repository as unknown as AttemptsRepository,
      quizzes as unknown as QuizzesRepository,
    );
  });

  it.each([
    ['correct', 1, 100],
    ['wrong', 0, 0],
  ])(
    'grades option %s on the server',
    async (option, correctAnswers, score) => {
      const result = await service.submit('user', 'quiz', {
        answers: [{ questionId: 'question', selectedOptionId: option }],
      });
      expect(quizzes.findOwnedForGrading).toHaveBeenCalledWith('user', 'quiz');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user',
          totalQuestions: 1,
          correctAnswers,
        }),
      );
      expect(result.scorePercent).toBe(score);
      expect(result.answers[0].correctOptionId).toBe('correct');
    },
  );

  it.each([
    { answers: [] },
    { answers: [{ questionId: 'question', selectedOptionIds: [] }] },
  ])(
    'grades unanswered questions as incorrect: $answers',
    async ({ answers }) => {
      const result = await service.submit('user', 'quiz', { answers });
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ correctAnswers: 0, answers: [] }),
      );
      expect(result.answers[0]).toMatchObject({
        questionId: 'question',
        isCorrect: false,
        selectedOptionIds: [],
        selectedOptionId: null,
        correctOptionId: 'correct',
      });
    },
  );

  it.each(
    [
      [{ questionId: 'other', selectedOptionId: 'correct' }],
      [{ questionId: 'question', selectedOptionId: 'other' }],
      [
        { questionId: 'question', selectedOptionId: 'correct' },
        { questionId: 'question', selectedOptionId: 'wrong' },
      ],
      [null],
    ].map((answers) => ({ answers })),
  )(
    'rejects invalid answers without persisting: $answers',
    async ({ answers }) => {
      await expect(
        service.submit('user', 'quiz', {
          answers: answers as never,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(repository.create).not.toHaveBeenCalled();
    },
  );

  it('hides inaccessible quizzes', async () => {
    quizzes.findOwnedForGrading.mockResolvedValue(null);
    await expect(
      service.submit('other', 'quiz', { answers: [] }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects empty quiz structures', async () => {
    quizzes.findOwnedForGrading.mockResolvedValue({ ...quiz, questions: [] });
    await expect(
      service.submit('user', 'quiz', { answers: [] }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it.each([false, true])(
    'rejects invalid stored correctness before creating history: %s',
    async (allCorrect) => {
      quizzes.findOwnedForGrading.mockResolvedValue({
        ...quiz,
        questions: quiz.questions.map((question) => ({
          ...question,
          options: question.options.map((option) => ({
            ...option,
            isCorrect: allCorrect,
          })),
        })),
      });
      await expect(
        service.submit('user', 'quiz', {
          answers: [{ questionId: 'question', selectedOptionId: 'correct' }],
        }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(repository.create).not.toHaveBeenCalled();
    },
  );

  it('lists only the current user attempts with normalized pagination', async () => {
    await service.listMine('user');
    expect(repository.findManyByUser).toHaveBeenCalledWith('user', {
      limit: 20,
      offset: 0,
    });
    await service.listForQuiz('user', 'quiz', { limit: 5 });
    expect(repository.findManyByUser).toHaveBeenLastCalledWith(
      'user',
      { limit: 5, offset: 0 },
      'quiz',
    );
    quizzes.findOwnedById.mockResolvedValue(null);
    await expect(service.listForQuiz('other', 'quiz')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('returns a stored result and hides missing attempts', async () => {
    repository.findByIdForUser.mockResolvedValue(null);
    await expect(service.getResult('user', 'missing')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    repository.findByIdForUser.mockResolvedValue({
      id: 'attempt',
      quizId: 'quiz',
      quizDisplayName: 'Quiz',
      materialId: 'material',
      workspaceId: 'workspace',
      submittedAt: new Date(),
      totalQuestions: 1,
      correctAnswers: 0,
      scorePercent: 0,
      quizQuestions: quiz.questions,
      answers: [
        {
          questionId: 'question',
          selectedOptionId: 'wrong',
          isCorrect: false,
          question: quiz.questions[0],
          option: { optionText: 'No' },
        },
      ],
    });
    const result = await service.getResult('user', 'attempt');
    expect(result.answers[0]).toMatchObject({
      correctOptionId: 'correct',
      selectedOptionText: 'No',
      isCorrect: false,
    });
  });
});
