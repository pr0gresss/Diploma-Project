import {
  WorkspacesService,
  validateWorkspaceName,
} from './workspaces.service.js';
import { WorkspacesRepository } from './workspaces.repository.js';
import { NotFoundError, ValidationError } from '../../common/errors/index.js';
import type { ObjectStorage } from '../../infrastructure/storage/object-storage.interface.js';

describe('WorkspacesService', () => {
  const workspace = { id: 'workspace', name: 'Name' };
  let repository: {
    findManyByOwner: ReturnType<typeof vi.fn>;
    findOwnedById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    rename: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let storage: { delete: ReturnType<typeof vi.fn> };
  let service: WorkspacesService;
  beforeEach(() => {
    repository = {
      findManyByOwner: vi.fn(),
      findOwnedById: vi.fn().mockResolvedValue(workspace),
      create: vi.fn().mockResolvedValue(workspace),
      rename: vi.fn().mockResolvedValue(workspace),
      delete: vi.fn().mockResolvedValue(['original', 'guide']),
    };
    storage = { delete: vi.fn() };
    service = new WorkspacesService(
      repository as unknown as WorkspacesRepository,
      storage as unknown as ObjectStorage,
    );
  });
  it('normalizes list queries and names', async () => {
    await service.list('user', { search: ' Name ' });
    expect(repository.findManyByOwner).toHaveBeenCalledWith('user', {
      limit: 20,
      offset: 0,
      search: 'Name',
    });
    await service.create('user', { name: ' Name ' });
    expect(repository.create).toHaveBeenCalledWith('user', 'Name');
    await service.rename('user', 'workspace', { name: ' Renamed ' });
    expect(repository.rename).toHaveBeenCalledWith('workspace', 'Renamed');
    expect(await service.get('user', 'workspace')).toEqual(workspace);
  });
  it('hides inaccessible workspaces and never mutates them', async () => {
    repository.findOwnedById.mockResolvedValue(null);
    await expect(service.get('other', 'workspace')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(
      service.rename('other', 'workspace', { name: 'Name' }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.delete('other', 'workspace')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(repository.rename).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });
  it('cleans storage after database deletion', async () => {
    await service.delete('user', 'workspace');
    expect(storage.delete).toHaveBeenCalledTimes(2);
    expect(repository.delete.mock.invocationCallOrder[0]).toBeLessThan(
      storage.delete.mock.invocationCallOrder[0],
    );
  });
  it('does not remove objects when the database rejects deletion', async () => {
    repository.delete.mockRejectedValue(new Error('restricted'));
    await expect(service.delete('user', 'workspace')).rejects.toThrow(
      'restricted',
    );
    expect(storage.delete).not.toHaveBeenCalled();
  });
  it('does not undo a committed deletion when cleanup fails', async () => {
    storage.delete.mockRejectedValue(new Error('storage unavailable'));
    await expect(service.delete('user', 'workspace')).resolves.toBeUndefined();
  });
  it.each(['', ' ', 'a'.repeat(121)])('rejects invalid names', (name) => {
    expect(() => validateWorkspaceName(name)).toThrow(ValidationError);
  });
});
