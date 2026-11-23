import { MaterialsService } from './materials.service.js';
import { MaterialsRepository } from './materials.repository.js';
import { WorkspacesRepository } from '../workspaces/workspaces.repository.js';
import { ProcessingJobsService } from '../processing-jobs/processing-jobs.service.js';
import { ConflictError, NotFoundError } from '../../common/errors/index.js';
import type { ObjectStorage } from '../../infrastructure/storage/object-storage.interface.js';

describe('MaterialsService', () => {
  const material = { id: 'material', processingStatus: 'UPLOADED' };
  let repository: {
    createWithExtractionJob: ReturnType<typeof vi.fn>;
    findManyByWorkspace: ReturnType<typeof vi.fn>;
    findOwnedById: ReturnType<typeof vi.fn>;
    findOwnedRaw: ReturnType<typeof vi.fn>;
    rename: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findStorageKeys: ReturnType<typeof vi.fn>;
  };
  let workspaces: { findOwnedById: ReturnType<typeof vi.fn> };
  let jobs: { enqueueExtraction: ReturnType<typeof vi.fn> };
  let storage: {
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    getText: ReturnType<typeof vi.fn>;
  };
  let service: MaterialsService;
  const upload = () => {
    const buffer = Buffer.from('%PDF-1.7\nfixture');
    return {
      file: {
        buffer,
        size: buffer.length,
        originalname: 'notes.pdf',
        mimetype: 'application/pdf',
      },
    };
  };
  beforeEach(() => {
    repository = {
      createWithExtractionJob: vi.fn().mockResolvedValue(material),
      findManyByWorkspace: vi.fn(),
      findOwnedById: vi.fn().mockResolvedValue(material),
      findOwnedRaw: vi
        .fn()
        .mockResolvedValue({ extractedTextKey: 'extracted.txt' }),
      rename: vi.fn().mockResolvedValue(material),
      delete: vi.fn(),
      findStorageKeys: vi
        .fn()
        .mockResolvedValue(['original.pdf', 'extracted.txt']),
    };
    workspaces = {
      findOwnedById: vi.fn().mockResolvedValue({ id: 'workspace' }),
    };
    jobs = { enqueueExtraction: vi.fn() };
    storage = {
      put: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn().mockResolvedValue(true),
      getText: vi.fn().mockResolvedValue('Text'),
    };
    service = new MaterialsService(
      repository as unknown as MaterialsRepository,
      workspaces as unknown as WorkspacesRepository,
      jobs as unknown as ProcessingJobsService,
      storage as unknown as ObjectStorage,
    );
  });
  it('validates and uploads before publishing metadata and extraction job', async () => {
    expect(await service.upload('user', 'workspace', upload())).toEqual(
      material,
    );
    expect(repository.createWithExtractionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace',
        displayName: 'notes',
        mimeType: 'application/pdf',
      }),
    );
    expect(storage.put.mock.invocationCallOrder[0]).toBeLessThan(
      repository.createWithExtractionJob.mock.invocationCallOrder[0],
    );
    await service.upload('user', 'workspace', {
      ...upload(),
      displayName: ' Custom ',
    });
    expect(repository.createWithExtractionJob).toHaveBeenLastCalledWith(
      expect.objectContaining({ displayName: 'Custom' }),
    );
  });
  it('cleans an orphan upload when metadata creation fails', async () => {
    repository.createWithExtractionJob.mockRejectedValue(
      new Error('database failure'),
    );
    await expect(service.upload('user', 'workspace', upload())).rejects.toThrow(
      'database failure',
    );
    expect(storage.delete).toHaveBeenCalledWith(storage.put.mock.calls[0][0]);
  });
  it('rejects inaccessible workspaces before writing a file', async () => {
    workspaces.findOwnedById.mockResolvedValue(null);
    await expect(
      service.upload('other', 'workspace', upload()),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.list('other', 'workspace')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(storage.put).not.toHaveBeenCalled();
  });
  it('lists and filters by status', async () => {
    await service.list('user', 'workspace');
    await service.list('user', 'workspace', {
      status: 'READY',
      search: ' notes ',
    });
    expect(repository.findManyByWorkspace).toHaveBeenLastCalledWith(
      'user',
      'workspace',
      { limit: 20, offset: 0, status: 'READY', search: 'notes' },
    );
    expect(await service.get('user', 'material')).toEqual(material);
  });
  it('renames and deletes only owned materials', async () => {
    await service.rename('user', 'material', { displayName: ' Name ' });
    expect(repository.rename).toHaveBeenCalledWith('material', 'Name');
    await service.delete('user', 'material');
    expect(storage.delete).toHaveBeenCalledTimes(2);
    repository.findOwnedById.mockResolvedValue(null);
    await expect(service.get('other', 'material')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(
      service.rename('other', 'material', { displayName: 'Name' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
  it('tolerates cleanup failures after committed deletion', async () => {
    storage.delete.mockRejectedValue(new Error('storage unavailable'));
    await expect(service.delete('user', 'material')).resolves.toBeUndefined();
  });
  it('retries extraction only when the material is neither ready nor processing', async () => {
    await service.retryExtraction('user', 'material');
    expect(jobs.enqueueExtraction).toHaveBeenCalledWith('material');
    for (const processingStatus of ['READY', 'PROCESSING']) {
      repository.findOwnedById.mockResolvedValue({
        ...material,
        processingStatus,
      });
      await expect(
        service.retryExtraction('user', 'material'),
      ).rejects.toBeInstanceOf(ConflictError);
    }
  });
  it('reads extracted text and reports missing metadata or objects', async () => {
    expect(await service.readExtractedText('user', 'material')).toBe('Text');
    storage.exists.mockResolvedValue(false);
    await expect(
      service.readExtractedText('user', 'material'),
    ).rejects.toBeInstanceOf(NotFoundError);
    repository.findOwnedRaw.mockResolvedValue({ extractedTextKey: null });
    await expect(
      service.readExtractedText('user', 'material'),
    ).rejects.toBeInstanceOf(NotFoundError);
    repository.findOwnedRaw.mockResolvedValue(null);
    await expect(
      service.readExtractedText('other', 'material'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
