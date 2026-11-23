import {
  ProcessingJobsService,
  sanitizeErrorMessage,
} from './processing-jobs.service.js';
import { ProcessingJobsRepository } from './processing-jobs.repository.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/index.js';
import type { ObjectStorage } from '../../infrastructure/storage/object-storage.interface.js';

describe('ProcessingJobsService', () => {
  let repository: {
    findOwnedMaterial: ReturnType<typeof vi.fn>;
    listByMaterial: ReturnType<typeof vi.fn>;
    createExtractionJob: ReturnType<typeof vi.fn>;
    claimNextQueued: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    completeExtraction: ReturnType<typeof vi.fn>;
    failExtraction: ReturnType<typeof vi.fn>;
  };
  let storage: {
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let service: ProcessingJobsService;
  const job = {
    id: 'job',
    materialId: 'material',
    jobType: 'EXTRACT_TEXT',
    status: 'RUNNING',
  };
  beforeEach(() => {
    repository = {
      findOwnedMaterial: vi.fn().mockResolvedValue({ id: 'material' }),
      listByMaterial: vi.fn(),
      createExtractionJob: vi.fn().mockResolvedValue(job),
      claimNextQueued: vi.fn().mockResolvedValue(job),
      findById: vi.fn().mockResolvedValue(job),
      completeExtraction: vi.fn().mockResolvedValue(job),
      failExtraction: vi.fn().mockResolvedValue(job),
    };
    storage = { put: vi.fn(), delete: vi.fn() };
    service = new ProcessingJobsService(
      repository as unknown as ProcessingJobsRepository,
      storage as unknown as ObjectStorage,
    );
  });
  it('lists jobs only for owned materials', async () => {
    await service.listForMaterial('user', 'material');
    expect(repository.listByMaterial).toHaveBeenCalledWith('material');
    repository.findOwnedMaterial.mockResolvedValue(null);
    await expect(
      service.listForMaterial('other', 'material'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
  it('enqueues and claims real repository jobs, including an empty queue', async () => {
    expect(await service.enqueueExtraction('material')).toEqual(job);
    expect(await service.claimNextJob()).toEqual(job);
    repository.claimNextQueued.mockResolvedValue(null);
    expect(await service.claimNextJob()).toBeNull();
  });
  it('writes extraction before publishing readiness', async () => {
    await service.completeExtraction('job', ' Extracted text ');
    expect(storage.put).toHaveBeenCalledWith(
      expect.any(String),
      'Extracted text',
    );
    expect(repository.completeExtraction).toHaveBeenCalledWith(
      'job',
      'material',
      storage.put.mock.calls[0][0],
      'Extracted text',
    );
    expect(storage.put.mock.invocationCallOrder[0]).toBeLessThan(
      repository.completeExtraction.mock.invocationCallOrder[0],
    );
  });
  it('removes unpublished text when deletion races publication', async () => {
    repository.findById.mockResolvedValueOnce(job).mockResolvedValueOnce(null);
    repository.completeExtraction.mockRejectedValue(new Error('Job deleted'));
    await expect(service.completeExtraction('job', 'Text')).rejects.toThrow(
      'Job deleted',
    );
    expect(storage.delete).toHaveBeenCalledWith(storage.put.mock.calls[0][0]);
  });
  it('reconciles an upload whose response was lost before publication', async () => {
    storage.put.mockRejectedValue(new Error('Upload response lost'));
    await expect(service.completeExtraction('job', 'Text')).rejects.toThrow(
      'Upload response lost',
    );
    expect(storage.delete).toHaveBeenCalledWith(storage.put.mock.calls[0][0]);
    expect(repository.completeExtraction).not.toHaveBeenCalled();
  });
  it('keeps output when the commit succeeded but its response was lost', async () => {
    repository.findById
      .mockResolvedValueOnce(job)
      .mockResolvedValueOnce({ ...job, status: 'SUCCEEDED' });
    repository.completeExtraction.mockRejectedValue(new Error('Response lost'));
    await expect(
      service.completeExtraction('job', 'Text'),
    ).resolves.toMatchObject({ status: 'SUCCEEDED' });
    expect(storage.delete).not.toHaveBeenCalled();
  });
  it.each([
    [null, NotFoundError],
    [{ ...job, jobType: 'GENERATE_GUIDE' }, ValidationError],
    [{ ...job, status: 'SUCCEEDED' }, ConflictError],
  ])('rejects invalid job lifecycle %#', async (stored, error) => {
    repository.findById.mockResolvedValue(stored);
    await expect(
      service.completeExtraction('job', 'Text'),
    ).rejects.toBeInstanceOf(error);
    await expect(
      service.failExtraction('job', 'Failure'),
    ).rejects.toBeInstanceOf(error);
    expect(storage.put).not.toHaveBeenCalled();
  });
  it.each(['', 'a'.repeat(20 * 1024 * 1024 + 1)])(
    'rejects invalid extraction text',
    async (text) => {
      await expect(
        service.completeExtraction('job', text),
      ).rejects.toBeInstanceOf(ValidationError);
    },
  );
  it('propagates failed completion instead of reporting success', async () => {
    repository.completeExtraction.mockRejectedValue(
      new Error('database failure'),
    );
    await expect(service.completeExtraction('job', 'Text')).rejects.toThrow(
      'database failure',
    );
  });
  it('records a normalized failure message', async () => {
    await service.failExtraction('job', ' Failed\n   extraction ');
    expect(repository.failExtraction).toHaveBeenCalledWith(
      'job',
      'material',
      'Failed extraction',
    );
    expect(sanitizeErrorMessage(null)).toBe('Text extraction failed');
    expect(sanitizeErrorMessage('a'.repeat(2001))).toHaveLength(2000);
  });
});
