import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ConflictError, NotFoundError } from '../../common/errors/index.js';
import { rethrowPrismaError } from '../../common/prisma/prisma-error.mapper.js';
import type { ProcessingJobSummary } from './processing-jobs.types.js';

const jobSelect = {
  id: true,
  materialId: true,
  jobType: true,
  status: true,
  errorMessage: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
} as const;

interface ClaimedJobRow {
  id: string;
  materialId: string;
  jobType: ProcessingJobSummary['jobType'];
  status: ProcessingJobSummary['status'];
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

@Injectable()
export class ProcessingJobsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOwnedMaterial(
    ownerUserId: string,
    materialId: string,
  ): Promise<{ id: string; processingStatus: string } | null> {
    return this.prisma.material.findFirst({
      where: {
        id: materialId,
        workspace: { ownerUserId },
      },
      select: { id: true, processingStatus: true },
    });
  }

  async listByMaterial(materialId: string): Promise<ProcessingJobSummary[]> {
    return this.prisma.processingJob.findMany({
      where: { materialId },
      orderBy: { createdAt: 'desc' },
      select: jobSelect,
    });
  }

  async findById(jobId: string): Promise<ProcessingJobSummary | null> {
    return this.prisma.processingJob.findUnique({
      where: { id: jobId },
      select: jobSelect,
    });
  }

  async createExtractionJob(materialId: string): Promise<ProcessingJobSummary> {
    try {
      return await this.prisma.processingJob.create({
        data: {
          materialId,
          jobType: 'EXTRACT_TEXT',
        },
        select: jobSelect,
      });
    } catch (error) {
      return rethrowPrismaError(error, {
        conflict:
          'An extraction job is already queued or running for this material',
      });
    }
  }

  /**
   * Claims the oldest queued job with `FOR UPDATE SKIP LOCKED`. Two workers
   * can call this concurrently and never receive the same row.
   */
  async claimNextQueued(): Promise<
    | (ProcessingJobSummary & {
        material: {
          id: string;
          workspaceId: string;
          storageKey: string;
          processingStatus: string;
        };
      })
    | null
  > {
    return this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<ClaimedJobRow[]>`
        WITH claimed AS (
          SELECT id
          FROM processing_jobs
           WHERE status = 'QUEUED' AND job_type = 'EXTRACT_TEXT'
          ORDER BY created_at ASC, id ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE processing_jobs AS job
        SET status = 'RUNNING', started_at = now()
        FROM claimed
        WHERE job.id = claimed.id
        RETURNING
          job.id,
          job.material_id AS "materialId",
          job.job_type AS "jobType",
          job.status,
          job.error_message AS "errorMessage",
          job.created_at AS "createdAt",
          job.started_at AS "startedAt",
          job.finished_at AS "finishedAt"
      `;

      const job = rows[0];
      if (!job) {
        return null;
      }

      const material = await transaction.material.findUnique({
        where: { id: job.materialId },
        select: {
          id: true,
          workspaceId: true,
          storageKey: true,
          processingStatus: true,
        },
      });

      if (!material) {
        return null;
      }

      if (job.jobType === 'EXTRACT_TEXT') {
        await transaction.material.update({
          where: { id: material.id },
          data: { processingStatus: 'PROCESSING' },
          select: { id: true },
        });
      }

      return { ...job, material };
    });
  }

  async completeExtraction(
    jobId: string,
    materialId: string,
    extractedTextKey: string,
    extractedText?: string,
  ): Promise<ProcessingJobSummary> {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.processingJob.updateMany({
        where: {
          id: jobId,
          materialId,
          jobType: 'EXTRACT_TEXT',
          status: 'RUNNING',
        },
        data: {
          status: 'SUCCEEDED',
          errorMessage: null,
          finishedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        throw new ConflictError('The extraction job is not running');
      }

      await transaction.material.update({
        where: { id: materialId },
        data: {
          processingStatus: 'READY',
          extractedTextKey,
          ...(extractedText === undefined ? {} : { extractedText }),
        },
        select: { id: true },
      });

      const job = await transaction.processingJob.findUnique({
        where: { id: jobId },
        select: jobSelect,
      });

      if (!job) {
        throw new NotFoundError('Processing job not found');
      }

      return job;
    });
  }

  async failExtraction(
    jobId: string,
    materialId: string,
    errorMessage: string,
  ): Promise<ProcessingJobSummary> {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.processingJob.updateMany({
        where: {
          id: jobId,
          materialId,
          jobType: 'EXTRACT_TEXT',
          status: 'RUNNING',
        },
        data: {
          status: 'FAILED',
          errorMessage,
          finishedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        throw new ConflictError('The extraction job is not running');
      }

      await transaction.material.update({
        where: { id: materialId },
        data: { processingStatus: 'FAILED' },
        select: { id: true },
      });

      const job = await transaction.processingJob.findUnique({
        where: { id: jobId },
        select: jobSelect,
      });

      if (!job) {
        throw new NotFoundError('Processing job not found');
      }

      return job;
    });
  }
}
