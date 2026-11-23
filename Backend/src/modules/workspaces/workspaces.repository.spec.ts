import { WorkspacesRepository } from './workspaces.repository.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ConflictError } from '../../common/errors/index.js';

describe('Workspace deletion coordination', () => {
  function setup(running: number) {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'workspace' }]),
      processingJob: { count: vi.fn().mockResolvedValue(running) },
      material: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            {
              storageKey: 'original',
              extractedTextKey: 'text',
              studyGuides: [],
            },
          ]),
      },
      workspace: { delete: vi.fn() },
    };
    return {
      repository: new WorkspacesRepository({
        $transaction: (callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
      } as unknown as PrismaService),
      tx,
    };
  }
  it('protects active jobs in child materials', async () => {
    const { repository, tx } = setup(1);
    await expect(repository.delete('workspace')).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(tx.workspace.delete).not.toHaveBeenCalled();
  });
  it('locks the parent and its materials before collecting cleanup keys', async () => {
    const { repository, tx } = setup(0);
    expect(await repository.delete('workspace')).toEqual(['original', 'text']);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(
      tx.processingJob.count.mock.invocationCallOrder[0],
    );
    expect(tx.processingJob.count).toHaveBeenCalledWith({
      where: { material: { workspaceId: 'workspace' }, status: 'RUNNING' },
    });
  });
});
