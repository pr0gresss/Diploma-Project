import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { rethrowPrismaError } from '../../common/prisma/prisma-error.mapper.js';
import { ConflictError, NotFoundError } from '../../common/errors/index.js';
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

  async delete(workspaceId: string): Promise<string[]> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const locked = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM workspaces WHERE id = ${workspaceId}::uuid FOR UPDATE
        `;
        if (!locked.length) throw new NotFoundError('Workspace not found');
        // Prevent new claims while checking jobs and collecting output keys.
        await transaction.$queryRaw`
          SELECT id FROM materials WHERE workspace_id = ${workspaceId}::uuid ORDER BY id FOR UPDATE
        `;
        const running = await transaction.processingJob.count({
          where: { material: { workspaceId }, status: 'RUNNING' },
        });
        if (running)
          throw new ConflictError(
            'Wait for active processing before deleting this workspace',
          );
        const materials = await transaction.material.findMany({
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
          if (material.extractedTextKey) keys.add(material.extractedTextKey);
          for (const guide of material.studyGuides) keys.add(guide.storageKey);
        }
        await transaction.workspace.delete({
          where: { id: workspaceId },
          select: { id: true },
        });
        return [...keys];
      });
    } catch (error) {
      return rethrowPrismaError(error, {
        notFound: 'Workspace not found',
        conflict:
          'The workspace contains quiz assessment history and cannot be deleted',
      });
    }
  }
}
