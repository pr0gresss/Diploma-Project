import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotFoundError, ValidationError } from '../../common/errors/index.js';
import { errorDetails, logEvent } from '../../common/logging/log-event.js';
import { normalizePageQuery, type Page } from '../../common/pagination.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../infrastructure/storage/object-storage.interface.js';
import { WorkspacesRepository } from './workspaces.repository.js';
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  WorkspaceListQuery,
  WorkspaceSummary,
} from './workspaces.types.js';

const WORKSPACE_NAME_MAX_LENGTH = 120;

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    private readonly workspacesRepository: WorkspacesRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async list(
    ownerUserId: string,
    query: WorkspaceListQuery = {},
  ): Promise<Page<WorkspaceSummary>> {
    return this.workspacesRepository.findManyByOwner(
      ownerUserId,
      normalizePageQuery(query),
    );
  }

  async get(
    ownerUserId: string,
    workspaceId: string,
  ): Promise<WorkspaceSummary> {
    return this.findOwnedOrThrow(ownerUserId, workspaceId);
  }

  async create(
    ownerUserId: string,
    input: CreateWorkspaceInput,
  ): Promise<WorkspaceSummary> {
    const name = validateWorkspaceName(input.name);
    const workspace = await this.workspacesRepository.create(ownerUserId, name);

    logEvent(this.logger, 'log', 'workspace_created', {
      workspaceId: workspace.id,
      ownerUserId,
    });

    return workspace;
  }

  async rename(
    ownerUserId: string,
    workspaceId: string,
    input: UpdateWorkspaceInput,
  ): Promise<WorkspaceSummary> {
    await this.findOwnedOrThrow(ownerUserId, workspaceId);
    const name = validateWorkspaceName(input.name);
    const workspace = await this.workspacesRepository.rename(workspaceId, name);

    logEvent(this.logger, 'log', 'workspace_renamed', {
      workspaceId,
      ownerUserId,
    });

    return workspace;
  }

  /**
   * Deletes the database row first, then cleans up private objects. A storage
   * failure is logged and does not resurrect an already-deleted workspace.
   */
  async delete(ownerUserId: string, workspaceId: string): Promise<void> {
    await this.findOwnedOrThrow(ownerUserId, workspaceId);
    const storageKeys = await this.workspacesRepository.delete(workspaceId);
    await this.deleteStorageObjects(storageKeys);

    logEvent(this.logger, 'log', 'workspace_deleted', {
      workspaceId,
      ownerUserId,
      deletedObjects: storageKeys.length,
    });
  }

  async findOwnedOrThrow(
    ownerUserId: string,
    workspaceId: string,
  ): Promise<WorkspaceSummary> {
    const workspace = await this.workspacesRepository.findOwnedById(
      ownerUserId,
      workspaceId,
    );

    if (!workspace) {
      // Cross-user access is indistinguishable from a missing resource.
      throw new NotFoundError('Workspace not found');
    }

    return workspace;
  }

  private async deleteStorageObjects(keys: string[]): Promise<void> {
    const results = await Promise.allSettled(
      keys.map((key) => this.storage.delete(key)),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        logEvent(this.logger, 'warn', 'workspace_storage_cleanup_failed', {
          ...errorDetails(result.reason),
        });
      }
    }
  }
}

export function validateWorkspaceName(value: string): string {
  const name = value?.trim();

  if (!name) {
    throw new ValidationError('The workspace name must not be blank');
  }
  if (name.length > WORKSPACE_NAME_MAX_LENGTH) {
    throw new ValidationError(
      `The workspace name must not exceed ${WORKSPACE_NAME_MAX_LENGTH} characters`,
    );
  }

  return name;
}
