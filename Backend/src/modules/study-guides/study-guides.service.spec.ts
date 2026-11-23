import { StudyGuidesService } from './study-guides.service.js';
import { StudyGuidesRepository } from './study-guides.repository.js';
import { MaterialsRepository } from '../materials/materials.repository.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/index.js';
import type { ObjectStorage } from '../../infrastructure/storage/object-storage.interface.js';

describe('StudyGuidesService', () => {
  let repository: {
    findManyByMaterial: ReturnType<typeof vi.fn>;
    findOwnedById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    rename: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let materials: { findOwnedById: ReturnType<typeof vi.fn> };
  let storage: {
    put: ReturnType<typeof vi.fn>;
    getText: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let service: StudyGuidesService;
  beforeEach(() => {
    repository = {
      findManyByMaterial: vi.fn(),
      findOwnedById: vi
        .fn()
        .mockResolvedValue({
          id: 'guide',
          storageKey: 'content.md',
          displayName: 'Guide',
        }),
      create: vi.fn().mockResolvedValue({ id: 'guide' }),
      rename: vi.fn(),
      delete: vi.fn(),
    };
    materials = {
      findOwnedById: vi
        .fn()
        .mockResolvedValue({
          displayName: 'Material',
          processingStatus: 'READY',
        }),
    };
    storage = {
      put: vi.fn(),
      getText: vi.fn().mockResolvedValue('# Content'),
      exists: vi.fn().mockResolvedValue(true),
      delete: vi.fn(),
    };
    service = new StudyGuidesService(
      repository as unknown as StudyGuidesRepository,
      materials as unknown as MaterialsRepository,
      storage as unknown as ObjectStorage,
    );
  });
  it('lists only owned material guides', async () => {
    await service.list('user', 'material');
    expect(repository.findManyByMaterial).toHaveBeenCalledWith(
      'user',
      'material',
      { limit: 20, offset: 0 },
    );
    materials.findOwnedById.mockResolvedValue(null);
    await expect(service.list('other', 'material')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
  it('loads content without returning the private storage key', async () => {
    expect(await service.get('user', 'guide')).toEqual({
      id: 'guide',
      displayName: 'Guide',
      content: '# Content',
    });
    storage.exists.mockResolvedValue(false);
    await expect(service.get('user', 'guide')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
  it('publishes metadata only after writing trimmed content', async () => {
    await service.create('user', 'material', { content: ' # Content ' });
    expect(storage.put).toHaveBeenCalledWith(
      expect.stringMatching(/^study-guides\/.*\/content\.md$/),
      '# Content',
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Material - study guide' }),
    );
    expect(storage.put.mock.invocationCallOrder[0]).toBeLessThan(
      repository.create.mock.invocationCallOrder[0],
    );
  });
  it.each(['', 'a'.repeat(5 * 1024 * 1024 + 1)])(
    'rejects blank or oversized content',
    async (content) => {
      await expect(
        service.create('user', 'material', { content }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(storage.put).not.toHaveBeenCalled();
    },
  );
  it('rejects unprocessed materials', async () => {
    materials.findOwnedById.mockResolvedValue({ processingStatus: 'FAILED' });
    await expect(
      service.create('user', 'material', { content: 'Content' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
  it('compensates for failed metadata creation', async () => {
    repository.create.mockRejectedValue(new Error('database failure'));
    await expect(
      service.create('user', 'material', { content: 'Content' }),
    ).rejects.toThrow('database failure');
    expect(storage.delete).toHaveBeenCalledWith(storage.put.mock.calls[0][0]);
  });
  it('renames and deletes owned guides and tolerates cleanup failures', async () => {
    await service.rename('user', 'guide', { displayName: ' Name ' });
    expect(repository.rename).toHaveBeenCalledWith('guide', 'Name');
    storage.delete.mockRejectedValue(new Error('storage failure'));
    await expect(service.delete('user', 'guide')).resolves.toBeUndefined();
  });
  it('rejects inaccessible guides without touching storage', async () => {
    repository.findOwnedById.mockResolvedValue(null);
    await expect(service.get('other', 'guide')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(service.delete('other', 'guide')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
