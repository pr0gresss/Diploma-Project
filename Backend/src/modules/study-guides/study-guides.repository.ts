import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { rethrowPrismaError } from '../../common/prisma/prisma-error.mapper.js';
import {
  pageOf,
  type NormalizedPageQuery,
  type Page,
} from '../../common/pagination.js';
import type { GuideSummary } from './study-guides.types.js';

const guideSelect = {
  id: true,
  materialId: true,
  displayName: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface OwnedGuide extends GuideSummary {
  storageKey: string;
}

@Injectable()
export class StudyGuidesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyByMaterial(
    ownerUserId: string,
    materialId: string,
    query: NormalizedPageQuery,
  ): Promise<Page<GuideSummary>> {
    const where = {
      materialId,
      material: { workspace: { ownerUserId } },
      ...(query.search
        ? {
            displayName: {
              contains: query.search,
              mode: 'insensitive' as const,
            },
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.studyGuide.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
        select: guideSelect,
      }),
      this.prisma.studyGuide.count({ where }),
    ]);

    return pageOf(rows, total, query);
  }

  async findOwnedById(
    ownerUserId: string,
    guideId: string,
  ): Promise<OwnedGuide | null> {
    return this.prisma.studyGuide.findFirst({
      where: {
        id: guideId,
        material: { workspace: { ownerUserId } },
      },
      select: {
        ...guideSelect,
        storageKey: true,
      },
    });
  }

  async create(data: {
    id: string;
    materialId: string;
    displayName: string;
    storageKey: string;
  }): Promise<GuideSummary> {
    try {
      return await this.prisma.studyGuide.create({
        data,
        select: guideSelect,
      });
    } catch (error) {
      return rethrowPrismaError(error, {
        conflict: 'The study guide conflicts with an existing record',
        validation: 'The study guide metadata is invalid',
      });
    }
  }

  async rename(guideId: string, displayName: string): Promise<GuideSummary> {
    try {
      return await this.prisma.studyGuide.update({
        where: { id: guideId },
        data: { displayName },
        select: guideSelect,
      });
    } catch (error) {
      return rethrowPrismaError(error, {
        notFound: 'Study guide not found',
        validation: 'The study guide name is invalid',
      });
    }
  }

  async touch(guideId: string): Promise<GuideSummary> {
    try {
      return await this.prisma.studyGuide.update({
        where: { id: guideId },
        data: { updatedAt: new Date() },
        select: guideSelect,
      });
    } catch (error) {
      return rethrowPrismaError(error, {
        notFound: 'Study guide not found',
        validation: 'The study guide metadata is invalid',
      });
    }
  }

  async delete(guideId: string): Promise<void> {
    try {
      await this.prisma.studyGuide.delete({
        where: { id: guideId },
        select: { id: true },
      });
    } catch (error) {
      return rethrowPrismaError(error, {
        notFound: 'Study guide not found',
      });
    }
  }
}
