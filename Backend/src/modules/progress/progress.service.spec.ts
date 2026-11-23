import { ProgressService } from './progress.service.js';
import { ProgressRepository } from './progress.repository.js';
import { ValidationError } from '../../common/errors/index.js';

describe('ProgressService', () => {
  it('combines the user-scoped page and overall totals', async () => {
    const page = { items: [], total: 0, limit: 20, offset: 0 };
    const overview = { totalAttempts: 0 };
    const repository = {
      findByUser: vi.fn().mockResolvedValue(page),
      getOverview: vi.fn().mockResolvedValue(overview),
    };
    const service = new ProgressService(
      repository as unknown as ProgressRepository,
    );
    expect(await service.getReport('user')).toEqual({ ...page, overview });
    expect(repository.findByUser).toHaveBeenCalledWith('user', {
      limit: 20,
      offset: 0,
    });
    expect(repository.getOverview).toHaveBeenCalledWith('user');
    expect(await service.getOverview('user')).toEqual(overview);
    await expect(
      service.getReport('user', { limit: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
