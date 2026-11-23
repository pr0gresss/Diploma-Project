import { QuizGenerationService } from './quiz-generation.service.js';
import { CompletionsService } from '../../infrastructure/ai/completions.service.js';
import { MaterialsService } from '../materials/materials.service.js';
import { QuizzesRepository } from './quizzes.repository.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  AiUnavailableError,
  ConflictError,
  ValidationError,
} from '../../common/errors/index.js';

describe('QuizGenerationService', () => {
  const question = {
    questionType: 'MULTI_SELECT',
    prompt: 'Select properties',
    explanation: null,
    options: [
      { text: 'Atomicity', isCorrect: true },
      { text: 'Consistency', isCorrect: true },
      { text: 'Randomness', isCorrect: false },
    ],
  };
  const options = {
    questionCount: 1,
    questionTypes: ['MULTI_SELECT'] as ['MULTI_SELECT'],
  };
  function setup() {
    const completions = {
      maxContextChars: 60000,
      assertAllowed: vi.fn(),
      completeJson: vi
        .fn()
        .mockResolvedValue({
          displayName: 'Generated quiz',
          questions: [question],
        }),
    };
    const materials = {
      get: vi.fn().mockResolvedValue({ processingStatus: 'READY' }),
      readExtractedText: vi
        .fn()
        .mockResolvedValue('Transactions are atomic and consistent.'),
    };
    const quizzes = {
      publishGenerated: vi.fn().mockResolvedValue({ id: 'quiz' }),
    };
    const jobs = {
      create: vi.fn().mockResolvedValue({ id: 'job' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    const service = new QuizGenerationService(
      completions as unknown as CompletionsService,
      materials as unknown as MaterialsService,
      quizzes as unknown as QuizzesRepository,
      { processingJob: jobs } as unknown as PrismaService,
    );
    return { service, completions, materials, quizzes, jobs };
  }
  it('generates from owned extracted text and atomically publishes validated questions', async () => {
    const { service, completions, materials, quizzes } = setup();
    expect(await service.generate('owner', 'material', options)).toEqual({
      id: 'quiz',
    });
    expect(materials.get).toHaveBeenCalledWith('owner', 'material');
    expect(completions.completeJson).toHaveBeenCalledWith(
      'owner',
      expect.stringContaining('Transactions are atomic'),
      expect.anything(),
    );
    expect(quizzes.publishGenerated).toHaveBeenCalledWith(
      'job',
      expect.objectContaining({
        materialId: 'material',
        questions: [expect.objectContaining({ questionType: 'MULTI_SELECT' })],
      }),
    );
  });
  it('does not start jobs for unready materials, oversized sources or invalid options', async () => {
    const { service, materials, jobs } = setup();
    materials.get.mockResolvedValue({ processingStatus: 'UPLOADED' });
    await expect(
      service.generate('owner', 'material', options),
    ).rejects.toBeInstanceOf(ConflictError);
    materials.get.mockResolvedValue({ processingStatus: 'READY' });
    materials.readExtractedText.mockResolvedValue('a'.repeat(120001));
    await expect(
      service.generate('owner', 'material', options),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.generate('owner', 'material', { ...options, questionCount: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(jobs.create).not.toHaveBeenCalled();
  });
  it.each(['provider', 'count', 'correctness'])(
    'records %s failure without a partial quiz',
    async (failure) => {
      const { service, completions, jobs, quizzes } = setup();
      if (failure === 'provider')
        completions.completeJson.mockRejectedValue(
          new Error('sensitive upstream payload'),
        );
      if (failure === 'count')
        completions.completeJson.mockResolvedValue({
          displayName: 'Quiz',
          questions: [],
        });
      if (failure === 'correctness')
        completions.completeJson.mockResolvedValue({
          displayName: 'Quiz',
          questions: [
            {
              ...question,
              options: question.options.map((option) => ({
                ...option,
                isCorrect: false,
              })),
            },
          ],
        });
      await expect(
        service.generate('owner', 'material', options),
      ).rejects.toBeInstanceOf(AiUnavailableError);
      expect(quizzes.publishGenerated).not.toHaveBeenCalled();
      expect(jobs.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            errorMessage: expect.not.stringContaining('sensitive'),
          }),
        }),
      );
    },
  );
});
