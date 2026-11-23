import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { rethrowPrismaError } from '../../common/prisma/prisma-error.mapper.js';
import { ConflictError, NotFoundError } from '../../common/errors/index.js';
import {
  pageOf,
  type NormalizedPageQuery,
  type Page,
} from '../../common/pagination.js';
import type { MaterialProcessingStatus } from '../../generated/prisma/enums.js';
import type {
  MaterialDetails,
  MaterialListQuery,
  MaterialSummary,
} from './materials.types.js';

const materialSummarySelect = {
  id: true,
  workspaceId: true,
  originalFilename: true,
  displayName: true,
  mimeType: true,
  sizeBytes: true,
  processingStatus: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      processingJobs: true,
      studyGuides: true,
      quizzes: true,
    },
  },
} as const;

export interface CreateMaterialData {
  id: string;
  workspaceId: string;
  originalFilename: string;
  displayName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
}

@Injectable()
export class MaterialsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyByWorkspace(
    ownerUserId: string,
    workspaceId: string,
    query: NormalizedPageQuery & Pick<MaterialListQuery, 'status'>,
  ): Promise<Page<MaterialSummary>> {
    const where = {
      workspaceId,
      workspace: { ownerUserId },
      ...(query.status ? { processingStatus: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              {
                displayName: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                originalFilename: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.material.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
        select: materialSummarySelect,
      }),
      this.prisma.material.count({ where }),
    ]);

    return pageOf(rows.map(toMaterialSummary), total, query);
  }

  async findOwnedById(
    ownerUserId: string,
    materialId: string,
  ): Promise<MaterialDetails | null> {
    const row = await this.prisma.material.findFirst({
      where: {
        id: materialId,
        workspace: { ownerUserId },
      },
      select: {
        ...materialSummarySelect,
        storageKey: true,
        extractedTextKey: true,
        processingJobs: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            materialId: true,
            jobType: true,
            status: true,
            errorMessage: true,
            createdAt: true,
            startedAt: true,
            finishedAt: true,
          },
        },
      },
    });

    if (!row) {
      return null;
    }

    const { processingJobs, ...summary } = row;
    return { ...toMaterialSummary(summary), processingJobs };
  }

  async findOwnedRaw(
    ownerUserId: string,
    materialId: string,
  ): Promise<{
    id: string;
    workspaceId: string;
    displayName: string;
    processingStatus: MaterialProcessingStatus;
    extractedTextKey: string | null;
  } | null> {
    return this.prisma.material.findFirst({
      where: {
        id: materialId,
        workspace: { ownerUserId },
      },
      select: {
        id: true,
        workspaceId: true,
        displayName: true,
        processingStatus: true,
        extractedTextKey: true,
      },
    });
  }

  async createWithExtractionJob(
    data: CreateMaterialData,
  ): Promise<MaterialDetails> {
    try {
      const row = await this.prisma.material.create({
        data: {
          id: data.id,
          workspaceId: data.workspaceId,
          originalFilename: data.originalFilename,
          displayName: data.displayName,
          mimeType: data.mimeType,
          sizeBytes: data.sizeBytes,
          storageKey: data.storageKey,
          processingStatus: 'UPLOADED',
          processingJobs: {
            create: { jobType: 'EXTRACT_TEXT' },
          },
        },
        select: {
          ...materialSummarySelect,
          processingJobs: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              materialId: true,
              jobType: true,
              status: true,
              errorMessage: true,
              createdAt: true,
              startedAt: true,
              finishedAt: true,
            },
          },
        },
      });

      const { processingJobs, ...summary } = row;
      return { ...toMaterialSummary(summary), processingJobs };
    } catch (error) {
      return rethrowPrismaError(error, {
        conflict: 'The material metadata conflicts with an existing record',
        validation: 'The material metadata is invalid',
      });
    }
  }

  async rename(
    materialId: string,
    displayName: string,
  ): Promise<MaterialSummary> {
    try {
      const row = await this.prisma.material.update({
        where: { id: materialId },
        data: { displayName },
        select: materialSummarySelect,
      });

      return toMaterialSummary(row);
    } catch (error) {
      return rethrowPrismaError(error, {
        notFound: 'Material not found',
        validation: 'The material name is invalid',
      });
    }
  }

  async delete(materialId: string): Promise<string[]> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const locked = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM materials WHERE id = ${materialId}::uuid FOR UPDATE
        `;
        if (!locked.length) throw new NotFoundError('Material not found');
        const running = await transaction.processingJob.count({
          where: { materialId, status: 'RUNNING' },
        });
        if (running)
          throw new ConflictError(
            'Wait for active processing before deleting this material',
          );
        const material = await transaction.material.findUniqueOrThrow({
          where: { id: materialId },
          select: {
            storageKey: true,
            extractedTextKey: true,
            studyGuides: { select: { storageKey: true } },
          },
        });
        await transaction.material.delete({
          where: { id: materialId },
          select: { id: true },
        });
        return [
          material.storageKey,
          ...(material.extractedTextKey ? [material.extractedTextKey] : []),
          ...material.studyGuides.map((guide) => guide.storageKey),
        ];
      });
    } catch (error) {
      return rethrowPrismaError(error, {
        notFound: 'Material not found',
        conflict:
          'The material has quiz assessment history and cannot be deleted',
      });
    }
  }
}

function toMaterialSummary(row: {
  id: string;
  workspaceId: string;
  originalFilename: string;
  displayName: string;
  mimeType: string;
  sizeBytes: bigint;
  processingStatus: MaterialProcessingStatus;
  createdAt: Date;
  updatedAt: Date;
  _count: { processingJobs: number; studyGuides: number; quizzes: number };
}): MaterialSummary {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    originalFilename: row.originalFilename,
    displayName: row.displayName,
    mimeType: row.mimeType,
    sizeBytes: Number(row.sizeBytes),
    processingStatus: row.processingStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    jobCount: row._count.processingJobs,
    guideCount: row._count.studyGuides,
    quizCount: row._count.quizzes,
  };
}
