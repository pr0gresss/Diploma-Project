import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/index.js';
import { errorDetails, logEvent } from '../../common/logging/log-event.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../infrastructure/storage/object-storage.interface.js';
import { ProcessingJobsRepository } from './processing-jobs.repository.js';
import type {
  ClaimedJob,
  ProcessingJobSummary,
} from './processing-jobs.types.js';

const MAX_ERROR_MESSAGE_LENGTH = 2_000;
const MAX_EXTRACTED_TEXT_BYTES = 20 * 1024 * 1024;

@Injectable()
export class ProcessingJobsService {
  private readonly logger = new Logger(ProcessingJobsService.name);

  constructor(
    private readonly processingJobsRepository: ProcessingJobsRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async listForMaterial(
    ownerUserId: string,
    materialId: string,
  ): Promise<ProcessingJobSummary[]> {
    const material = await this.processingJobsRepository.findOwnedMaterial(
      ownerUserId,
      materialId,
    );

    if (!material) {
      throw new NotFoundError('Material not found');
    }

    return this.processingJobsRepository.listByMaterial(materialId);
  }

  async enqueueExtraction(materialId: string): Promise<ProcessingJobSummary> {
    const job =
      await this.processingJobsRepository.createExtractionJob(materialId);

    logEvent(this.logger, 'log', 'processing_job_queued', {
      jobId: job.id,
      materialId,
      jobType: job.jobType,
    });

    return job;
  }

  /**
   * Worker entry point. The repository claims one queued job atomically; the
   * worker then performs the external work outside any database transaction.
   */
  async claimNextJob(): Promise<ClaimedJob | null> {
    const job = await this.processingJobsRepository.claimNextQueued();

    if (job) {
      logEvent(this.logger, 'log', 'processing_job_claimed', {
        jobId: job.id,
        materialId: job.materialId,
        jobType: job.jobType,
      });
    }

    return job;
  }

  /**
   * Records a successful extraction. The extracted text is written to private
   * storage first; the short transaction then publishes the key and status.
   */
  async completeExtraction(
    jobId: string,
    extractedText: string,
  ): Promise<ProcessingJobSummary> {
    const job = await this.processingJobsRepository.findById(jobId);

    if (!job) {
      throw new NotFoundError('Processing job not found');
    }
    if (job.jobType !== 'EXTRACT_TEXT') {
      throw new ValidationError(
        'Only text-extraction jobs can be completed here',
      );
    }
    if (job.status !== 'RUNNING') {
      throw new ConflictError('Only a running job can be completed');
    }

    const text = typeof extractedText === 'string' ? extractedText.trim() : '';
    if (!text) {
      throw new ValidationError('Extracted text must not be blank');
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_EXTRACTED_TEXT_BYTES) {
      throw new ValidationError('Extracted text exceeds the 20 MiB limit');
    }

    const extractedTextKey = this.extractedTextKey(job.materialId);
    await this.storage.put(extractedTextKey, text);

    try {
      const completed = await this.processingJobsRepository.completeExtraction(
        jobId,
        job.materialId,
        extractedTextKey,
        text,
      );

      logEvent(this.logger, 'log', 'processing_job_succeeded', {
        jobId,
        materialId: job.materialId,
        jobType: job.jobType,
      });

      return completed;
    } catch (error) {
      // The database is the source of truth; an unreferenced object is logged
      // for reconciliation instead of being presented as success.
      logEvent(this.logger, 'error', 'processing_job_completion_failed', {
        jobId,
        materialId: job.materialId,
        ...errorDetails(error),
      });
      throw error;
    }
  }

  async failExtraction(
    jobId: string,
    errorMessage: string,
  ): Promise<ProcessingJobSummary> {
    const job = await this.processingJobsRepository.findById(jobId);

    if (!job) {
      throw new NotFoundError('Processing job not found');
    }
    if (job.jobType !== 'EXTRACT_TEXT') {
      throw new ValidationError('Only text-extraction jobs can fail here');
    }
    if (job.status !== 'RUNNING') {
      throw new ConflictError('Only a running job can fail');
    }

    const safeMessage = sanitizeErrorMessage(errorMessage);
    const failed = await this.processingJobsRepository.failExtraction(
      jobId,
      job.materialId,
      safeMessage,
    );

    logEvent(this.logger, 'warn', 'processing_job_failed', {
      jobId,
      materialId: job.materialId,
      jobType: job.jobType,
      reason: safeMessage,
    });

    return failed;
  }

  extractedTextKey(materialId: string): string {
    return `materials/${materialId}/extracted.txt`;
  }
}

export function sanitizeErrorMessage(message: unknown): string {
  const normalized =
    typeof message === 'string' ? message.replace(/\s+/g, ' ').trim() : '';

  if (!normalized) {
    return 'Text extraction failed';
  }

  return normalized.slice(0, MAX_ERROR_MESSAGE_LENGTH);
}
