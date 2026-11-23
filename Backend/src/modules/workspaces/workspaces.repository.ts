import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { rethrowPrismaError } from '../../common/prisma/prisma-error.mapper.js';
import {
  pageOf,
  type NormalizedPageQuery,
  type Page,
} from '../../common/pagination.js';
import type { WorkspaceSummary } from './workspaces.types.js';

@Injectable()
export class WorkspacesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyByOwner(
    ownerUserId: string,
    query: NormalizedPageQuery,
  ): Promise<Page<WorkspaceSummary>> {
    const where = {
      ownerUserId,
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.workspace.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { materials: true } },
        },
      }),
      this.prisma.workspace.count({ where }),
    ]);

    return pageOf(
      rows.map(({ _count, ...workspace }) => ({
        ...workspace,
        materialCount: _count.materials,
      })),
      total,
      query,
    );
  }

  async findOwnedById(
    ownerUserId: string,
    workspaceId: string,
  ): Promise<WorkspaceSummary | null> {
    const row = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, ownerUserId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { materials: true } },
      },
    });

    if (!row) {
      return null;
    }

    const { _count, ...workspace } = row;
    return { ...workspace, materialCount: _count.materials };
  }

  async create(ownerUserId: string, name: string): Promise<WorkspaceSummary> {
    const row = await this.prisma.workspace.create({
      data: { ownerUserId, name },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { materials: true } },
      },
    });

    const { _count, ...workspace } = row;
    return { ...workspace, materialCount: _count.materials };
  }

  async rename(workspaceId: string, name: string): Promise<WorkspaceSummary> {
    try {
      const row = await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { name },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { materials: true } },
        },
      });

      const { _count, ...workspace } = row;
      return { ...workspace, materialCount: _count.materials };
    } catch (error) {
      return rethrowPrismaError(error, { notFound: 'Workspace not found' });
    }
  }

  async delete(workspaceId: string): Promise<void> {
    try {
      await this.prisma.workspace.delete({
        where: { id: workspaceId },
        select: { id: true },
      });
    } catch (error) {
      return rethrowPrismaError(error, {
        notFound: 'Workspace not found',
        conflict:
          'The workspace contains quiz assessment history and cannot be deleted',
      });
    }
  }

  /**
   * Returns every private object that belongs to the workspace tree so the
   * caller can clean up storage after the database commit.
   */
  async findStorageKeys(workspaceId: string): Promise<string[]> {
    const materials = await this.prisma.material.findMany({
      where: { workspaceId },
      select: {
        storageKey: true,
        extractedTextKey: true,
        studyGuides: { select: { storageKey: true } },
      },
    });

    const keys = new Set<string>();
    for (const material of materials) {
      keys.add(material.storageKey);
      if (material.extractedTextKey) {
        keys.add(material.extractedTextKey);
      }
      for (const guide of material.studyGuides) {
        keys.add(guide.storageKey);
      }
    }

    return [...keys];
  }
}
