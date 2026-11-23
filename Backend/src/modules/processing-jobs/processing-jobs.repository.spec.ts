import { ProcessingJobsRepository } from './processing-jobs.repository.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('Interrupted job recovery', () => {
  it('expires running jobs and changes material status only for expired extraction jobs', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([
        { materialId: 'extract', jobType: 'EXTRACT_TEXT' },
        { materialId: 'quiz', jobType: 'GENERATE_QUIZ' },
      ]),
      material: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const repository = new ProcessingJobsRepository({
      $transaction: (callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
    } as unknown as PrismaService);
    expect(await repository.recoverStaleJobs()).toBe(2);
    const sql = tx.$queryRaw.mock.calls[0][0].join('');
    expect(sql).toContain("status = 'RUNNING'");
    expect(sql).toContain("interval '15 minutes'");
    expect(tx.material.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['extract'] }, processingStatus: 'PROCESSING' },
      data: { processingStatus: 'FAILED' },
    });
  });
  it('does not touch material state when no jobs have expired', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      material: { updateMany: vi.fn() },
    };
    const repository = new ProcessingJobsRepository({
      $transaction: (callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
    } as unknown as PrismaService);
    expect(await repository.recoverStaleJobs()).toBe(0);
    expect(tx.material.updateMany).not.toHaveBeenCalled();
  });
});
