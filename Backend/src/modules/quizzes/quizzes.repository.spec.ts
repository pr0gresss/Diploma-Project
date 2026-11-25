import { QuizzesRepository } from './quizzes.repository.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('Quiz deletion coordination', () => {
  it('removes drafts and attempts before deleting the quiz', async () => {
    const tx = {
      quizDraft: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      quizAttempt: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      quiz: { delete: vi.fn().mockResolvedValue({ id: 'quiz' }) },
    };
    const repository = new QuizzesRepository({
      $transaction: (callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
    } as unknown as PrismaService);

    await repository.delete('quiz');

    expect(tx.quizDraft.deleteMany).toHaveBeenCalledWith({
      where: { quizId: 'quiz' },
    });
    expect(tx.quizAttempt.deleteMany).toHaveBeenCalledWith({
      where: { quizId: 'quiz' },
    });
    expect(tx.quiz.delete).toHaveBeenCalledWith({
      where: { id: 'quiz' },
      select: { id: true },
    });
    expect(tx.quizDraft.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.quizAttempt.deleteMany.mock.invocationCallOrder[0],
    );
    expect(tx.quizAttempt.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.quiz.delete.mock.invocationCallOrder[0],
    );
  });
});
