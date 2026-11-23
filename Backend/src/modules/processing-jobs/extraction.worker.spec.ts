import { ConfigService } from '@nestjs/config';
import { ExtractionWorker } from './extraction.worker.js';
import { ProcessingJobsService } from './processing-jobs.service.js';
import type { ObjectStorage } from '../../infrastructure/storage/object-storage.interface.js';

describe('Extraction polling and recovery', () => {
  function setup(values: Record<string, unknown> = {}) {
    const jobs = {
      recoverStaleJobs: vi.fn().mockResolvedValue(0),
      claimNextJob: vi.fn().mockResolvedValue(null),
    };
    const worker = new ExtractionWorker(
      new ConfigService(values),
      jobs as unknown as ProcessingJobsService,
      {} as ObjectStorage,
    );
    return { jobs, worker };
  }
  it('can be completely disabled for scripts and tests', async () => {
    const { jobs, worker } = setup({
      PROCESSING_WORKER_ENABLED: 'false',
      TIKA_URL: 'http://tika:9998',
    });
    await worker.runOnce();
    expect(jobs.claimNextJob).not.toHaveBeenCalled();
    expect(jobs.recoverStaleJobs).not.toHaveBeenCalled();
  });
  it('recovers interrupted generation even when Tika is not configured', async () => {
    const { jobs, worker } = setup();
    await worker.runOnce();
    await worker.runOnce();
    expect(jobs.recoverStaleJobs).toHaveBeenCalledTimes(1);
    expect(jobs.claimNextJob).not.toHaveBeenCalled();
  });
});
