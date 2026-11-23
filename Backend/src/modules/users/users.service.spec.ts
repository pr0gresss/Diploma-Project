import { UsersService } from './users.service.js';
import { UsersRepository } from './users.repository.js';
import { NotFoundError } from '../../common/errors/index.js';

describe('UsersService', () => {
  it('returns the profile or not found without exposing credentials', async () => {
    const profile = { id: 'user', email: 'user@example.com' };
    const repository = { findById: vi.fn().mockResolvedValue(profile) };
    const service = new UsersService(repository as unknown as UsersRepository);
    expect(await service.getProfile('user')).toEqual(profile);
    expect(repository.findById).toHaveBeenCalledWith('user');
    repository.findById.mockResolvedValue(null);
    await expect(service.getProfile('missing')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
