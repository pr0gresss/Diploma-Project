import { QuizzesService, validateQuizStructure } from './quizzes.service.js';
import { QuizzesRepository } from './quizzes.repository.js';
import { MaterialsRepository } from '../materials/materials.repository.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/index.js';
import type { QuizQuestionInput } from './quizzes.types.js';

const question = (): QuizQuestionInput => ({
  prompt: ' Prompt ',
  explanation: ' Explanation ',
  options: [
    { text: ' Yes ', isCorrect: true },
    { text: ' No ', isCorrect: false },
  ],
});

describe('validateQuizStructure', () => {
  it('trims text and assigns unique IDs and sequential positions', () => {
    const result = validateQuizStructure(
      [question(), question()],
      'material',
      'Quiz',
    );
    expect(result.questions[0]).toMatchObject({
      position: 1,
      prompt: 'Prompt',
      explanation: 'Explanation',
    });
    expect(result.questions[1].position).toBe(2);
    expect(result.questions[0].options[0]).toMatchObject({
      position: 1,
      optionText: 'Yes',
    });
    expect(result.questions[0].id).not.toBe(result.questions[1].id);
  });

  it.each(
    [
      [],
      Array.from({ length: 101 }, question),
      [{ ...question(), prompt: '' }],
      [{ ...question(), prompt: 'a'.repeat(4001) }],
      [{ ...question(), explanation: 'a'.repeat(4001) }],
      [{ ...question(), options: [] }],
      [
        {
          ...question(),
          options: Array.from({ length: 11 }, () => ({
            text: 'option',
            isCorrect: false,
          })),
        },
      ],
      [
        {
          ...question(),
          options: [
            { text: '', isCorrect: true },
            { text: 'No', isCorrect: false },
          ],
        },
      ],
      [
        {
          ...question(),
          options: [
            { text: 'a'.repeat(1001), isCorrect: true },
            { text: 'No', isCorrect: false },
          ],
        },
      ],
      [
        {
          ...question(),
          options: [
            { text: 'Yes', isCorrect: false },
            { text: 'No', isCorrect: false },
          ],
        },
      ],
      [
        {
          ...question(),
          options: [
            { text: 'Yes', isCorrect: true },
            { text: 'No', isCorrect: true },
          ],
        },
      ],
      [
        {
          ...question(),
          options: [
            { text: 'Yes', isCorrect: 'true' },
            { text: 'No', isCorrect: false },
          ],
        },
      ],
    ].map((questions) => ({ questions })),
  )('rejects invalid structures %#', ({ questions }) => {
    expect(() =>
      validateQuizStructure(
        questions as QuizQuestionInput[],
        'material',
        'Quiz',
      ),
    ).toThrow(ValidationError);
  });

  it('normalizes absent explanations to null', () => {
    expect(
      validateQuizStructure(
        [{ ...question(), explanation: '' }],
        'material',
        'Quiz',
      ).questions[0].explanation,
    ).toBeNull();
  });
});

describe('QuizzesService', () => {
  let repository: {
    findManyByMaterial: ReturnType<typeof vi.fn>;
    findOwnedById: ReturnType<typeof vi.fn>;
    findOwnedForTaking: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    rename: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let materials: { findOwnedById: ReturnType<typeof vi.fn> };
  let service: QuizzesService;
  beforeEach(() => {
    repository = {
      findManyByMaterial: vi.fn(),
      findOwnedById: vi.fn().mockResolvedValue({ id: 'quiz' }),
      findOwnedForTaking: vi
        .fn()
        .mockResolvedValue({ id: 'quiz', questions: [] }),
      create: vi.fn().mockResolvedValue({ id: 'quiz', questionCount: 1 }),
      rename: vi.fn(),
      delete: vi.fn(),
    };
    materials = {
      findOwnedById: vi.fn().mockResolvedValue({
        displayName: 'Material',
        processingStatus: 'READY',
      }),
    };
    service = new QuizzesService(
      repository as unknown as QuizzesRepository,
      materials as unknown as MaterialsRepository,
    );
  });

  it('creates a validated quiz from a ready owned material', async () => {
    await service.create('user', 'material', { questions: [question()] });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        materialId: 'material',
        displayName: 'Material - quiz',
      }),
    );
  });

  it('rejects unprocessed and inaccessible materials', async () => {
    materials.findOwnedById.mockResolvedValue({ processingStatus: 'FAILED' });
    await expect(
      service.create('user', 'material', { questions: [question()] }),
    ).rejects.toBeInstanceOf(ConflictError);
    materials.findOwnedById.mockResolvedValue(null);
    await expect(service.list('other', 'material')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('lists with normalized pagination', async () => {
    await service.list('user', 'material');
    expect(repository.findManyByMaterial).toHaveBeenCalledWith(
      'user',
      'material',
      { limit: 20, offset: 0 },
    );
  });

  it('returns the safe quiz-taking representation', async () => {
    expect(await service.getForTaking('user', 'quiz')).toEqual({
      id: 'quiz',
      questions: [],
    });
    repository.findOwnedForTaking.mockResolvedValue(null);
    await expect(service.getForTaking('other', 'quiz')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('renames and deletes only owned quizzes', async () => {
    await service.rename('user', 'quiz', { displayName: ' New name ' });
    expect(repository.rename).toHaveBeenCalledWith('quiz', 'New name');
    await service.delete('user', 'quiz');
    expect(repository.delete).toHaveBeenCalledWith('quiz');
    repository.findOwnedById.mockResolvedValue(null);
    await expect(
      service.rename('other', 'quiz', { displayName: 'Name' }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.delete('other', 'quiz')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
