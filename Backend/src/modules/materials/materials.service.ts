import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConflictError, NotFoundError } from '../../common/errors/index.js';
import { errorDetails, logEvent } from '../../common/logging/log-event.js';
import { normalizePageQuery, type Page } from '../../common/pagination.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../infrastructure/storage/object-storage.interface.js';
import {
  validateDisplayName,
  validateMaterialFile,
} from '../../infrastructure/files/material-file.validator.js';
import type { ProcessingJobSummary } from '../processing-jobs/processing-jobs.types.js';
import { ProcessingJobsService } from '../processing-jobs/processing-jobs.service.js';
import { WorkspacesRepository } from '../workspaces/workspaces.repository.js';
import { MaterialsRepository } from './materials.repository.js';
import type {
  MaterialDetails,
  MaterialListQuery,
  MaterialRenameInput,
  MaterialSummary,
  UploadMaterialInput,
} from './materials.types.js';

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name);

  constructor(
    private readonly materialsRepository: MaterialsRepository,
    private readonly workspacesRepository: WorkspacesRepository,
    private readonly processingJobsService: ProcessingJobsService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async upload(
    ownerUserId: string,
    workspaceId: string,
    input: UploadMaterialInput,
  ): Promise<MaterialDetails> {
    const workspace = await this.workspacesRepository.findOwnedById(
      ownerUserId,
      workspaceId,
    );
    if (!workspace) {
      throw new NotFoundError('Workspace not found');
    }

    const file = validateMaterialFile(input.file);
    const displayName =
      input.displayName === undefined
        ? file.displayName
        : validateDisplayName(input.displayName);
    const materialId = randomUUID();
    const storageKey = `materials/${materialId}/original.${file.extension}`;

    await this.storage.put(storageKey, file.buffer);

    try {
      const material = await this.materialsRepository.createWithExtractionJob({
        id: materialId,
        workspaceId,
        originalFilename: file.originalFilename,
        displayName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        storageKey,
      });

      logEvent(this.logger, 'log', 'material_uploaded', {
        materialId,
        workspaceId,
        ownerUserId,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
      });

      return material;
    } catch (error) {
      // The database rejected the row: remove the object that no row refers to.
      await this.cleanupKeys([storageKey]);
      throw error;
    }
  }

  async list(
    ownerUserId: string,
    workspaceId: string,
    query: MaterialListQuery = {},
  ): Promise<Page<MaterialSummary>> {
    const workspace = await this.workspacesRepository.findOwnedById(
      ownerUserId,
      workspaceId,
    );
    if (!workspace) {
      throw new NotFoundError('Workspace not found');
    }

    const normalized = normalizePageQuery(query);
    return this.materialsRepository.findManyByWorkspace(
      ownerUserId,
      workspaceId,
      {
        ...normalized,
        ...(query.status ? { status: query.status } : {}),
      },
    );
  }

  async get(ownerUserId: string, materialId: string): Promise<MaterialDetails> {
    return this.findOwnedOrThrow(ownerUserId, materialId);
  }

  async rename(
    ownerUserId: string,
    materialId: string,
    input: MaterialRenameInput,
  ): Promise<MaterialSummary> {
    await this.findOwnedOrThrow(ownerUserId, materialId);
    const displayName = validateDisplayName(input.displayName);
    const material = await this.materialsRepository.rename(
      materialId,
      displayName,
    );

    logEvent(this.logger, 'log', 'material_renamed', {
      materialId,
      ownerUserId,
    });

    return material;
  }

  async delete(ownerUserId: string, materialId: string): Promise<void> {
    await this.findOwnedOrThrow(ownerUserId, materialId);
    const storageKeys = await this.materialsRepository.delete(materialId);
    await this.cleanupKeys(storageKeys);

    logEvent(this.logger, 'log', 'material_deleted', {
      materialId,
      ownerUserId,
      deletedObjects: storageKeys.length,
    });
  }

  /**
   * Queues a new extraction attempt for an uploaded or failed material. The
   * partial unique index prevents two active extraction jobs.
   */
  async retryExtraction(
    ownerUserId: string,
    materialId: string,
  ): Promise<ProcessingJobSummary> {
    const material = await this.findOwnedOrThrow(ownerUserId, materialId);

    if (material.processingStatus === 'READY') {
      throw new ConflictError('The material has already been processed');
    }
    if (material.processingStatus === 'PROCESSING') {
      throw new ConflictError('Text extraction is already in progress');
    }

    return this.processingJobsService.enqueueExtraction(materialId);
  }

  async readExtractedText(
    ownerUserId: string,
    materialId: string,
  ): Promise<string> {
    const material = await this.materialsRepository.findOwnedRaw(
      ownerUserId,
      materialId,
    );

    if (!material) {
      throw new NotFoundError('Material not found');
    }
    if (!material.extractedTextKey) {
      throw new NotFoundError(
        'Extracted text is not available for this material',
      );
    }
    if (!(await this.storage.exists(material.extractedTextKey))) {
      throw new NotFoundError(
        'Extracted text is not available for this material',
      );
    }

    return this.storage.getText(material.extractedTextKey);
  }

  async findOwnedOrThrow(
    ownerUserId: string,
    materialId: string,
  ): Promise<MaterialDetails> {
    const material = await this.materialsRepository.findOwnedById(
      ownerUserId,
      materialId,
    );

    if (!material) {
      throw new NotFoundError('Material not found');
    }

    return material;
  }

  private async cleanupKeys(keys: string[]): Promise<void> {
    const results = await Promise.allSettled(
      keys.map((key) => this.storage.delete(key)),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        logEvent(this.logger, 'warn', 'material_storage_cleanup_failed', {
          ...errorDetails(result.reason),
        });
      }
    }
  }
}
