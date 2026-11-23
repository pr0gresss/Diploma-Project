import { MaterialsRepository } from './materials.repository.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ConflictError } from '../../common/errors/index.js';

describe('Material deletion coordination', () => {
  function setup(running: number) {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'material' }]),
      processingJob: { count: vi.fn().mockResolvedValue(running) },
      material: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({
            storageKey: 'original',
            extractedTextKey: 'text',
            studyGuides: [{ storageKey: 'guide' }],
          }),
        delete: vi.fn(),
      },
    };
    const prisma = {
      $transaction: (callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
    };
    return {
      repository: new MaterialsRepository(prisma as unknown as PrismaService),
      tx,
    };
  }
  it('refuses deletion while a job can still publish output', async () => {
    const { repository, tx } = setup(1);
    await expect(repository.delete('material')).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(tx.material.delete).not.toHaveBeenCalled();
  });
  it('locks the material and collects keys in the same transaction as deletion', async () => {
    const { repository, tx } = setup(0);
    expect(await repository.delete('material')).toEqual([
      'original',
      'text',
      'guide',
    ]);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.processingJob.count.mock.invocationCallOrder[0],
    );
    expect(tx.processingJob.count).toHaveBeenCalledWith({
      where: { materialId: 'material', status: 'RUNNING' },
    });
    expect(
      tx.material.findUniqueOrThrow.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.material.delete.mock.invocationCallOrder[0]);
  });
});
