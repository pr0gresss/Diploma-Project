import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/index.js';
import { errorDetails, logEvent } from '../../common/logging/log-event.js';
import { normalizePageQuery, type Page } from '../../common/pagination.js';
import { validateDisplayName } from '../../infrastructure/files/material-file.validator.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../infrastructure/storage/object-storage.interface.js';
import { MaterialsRepository } from '../materials/materials.repository.js';
import { StudyGuidesRepository } from './study-guides.repository.js';
import type {
  CreateGuideInput,
  GuideListQuery,
  GuideSummary,
  GuideWithContent,
  RenameGuideInput,
  UpdateGuideContentInput,
} from './study-guides.types.js';

const MAX_GUIDE_CONTENT_BYTES = 5 * 1024 * 1024;

@Injectable()
export class StudyGuidesService {
  private readonly logger = new Logger(StudyGuidesService.name);

  constructor(
    private readonly studyGuidesRepository: StudyGuidesRepository,
    private readonly materialsRepository: MaterialsRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async list(
    ownerUserId: string,
    materialId: string,
    query: GuideListQuery = {},
  ): Promise<Page<GuideSummary>> {
    await this.findOwnedMaterialOrThrow(ownerUserId, materialId);

    return this.studyGuidesRepository.findManyByMaterial(
      ownerUserId,
      materialId,
      normalizePageQuery(query),
    );
  }

  async get(ownerUserId: string, guideId: string): Promise<GuideWithContent> {
    const guide = await this.findOwnedOrThrow(ownerUserId, guideId);

    if (!(await this.storage.exists(guide.storageKey))) {
      throw new NotFoundError('Study guide content is not available');
    }

    const content = await this.storage.getText(guide.storageKey);
    const { storageKey: _storageKey, ...summary } = guide;
    return { ...summary, content };
  }

  /**
   * Stores the Markdown object first and publishes its metadata row only after
   * the write succeeds, matching the storage/database boundary rules.
   */
  async create(
    ownerUserId: string,
    materialId: string,
    input: CreateGuideInput,
  ): Promise<GuideSummary> {
    const material = await this.findOwnedMaterialOrThrow(
      ownerUserId,
      materialId,
    );

    if (material.processingStatus !== 'READY') {
      throw new ConflictError(
        'A study guide can only be created from a processed material',
      );
    }

    const content =
      typeof input.content === 'string' ? input.content.trim() : '';
    if (!content) {
      throw new ValidationError('Study guide content must not be blank');
    }
    if (Buffer.byteLength(content, 'utf8') > MAX_GUIDE_CONTENT_BYTES) {
      throw new ValidationError('Study guide content exceeds the 5 MiB limit');
    }

    const displayName =
      input.displayName === undefined
        ? `${material.displayName} - study guide`.slice(0, 255)
        : validateDisplayName(input.displayName);
    const guideId = randomUUID();
    const storageKey = `study-guides/${guideId}/content.md`;

    await this.storage.put(storageKey, content);

    try {
      const guide = await this.studyGuidesRepository.create({
        id: guideId,
        materialId,
        displayName,
        storageKey,
      });

      logEvent(this.logger, 'log', 'study_guide_created', {
        guideId,
        materialId,
        ownerUserId,
      });

      return guide;
    } catch (error) {
      await this.cleanupKey(storageKey);
      throw error;
    }
  }

  async rename(
    ownerUserId: string,
    guideId: string,
    input: RenameGuideInput,
  ): Promise<GuideSummary> {
    await this.findOwnedOrThrow(ownerUserId, guideId);
    const displayName = validateDisplayName(input.displayName);
    const guide = await this.studyGuidesRepository.rename(guideId, displayName);

    logEvent(this.logger, 'log', 'study_guide_renamed', {
      guideId,
      ownerUserId,
    });

    return guide;
  }

  async updateContent(
    ownerUserId: string,
    guideId: string,
    input: UpdateGuideContentInput,
  ): Promise<GuideSummary> {
    const guide = await this.findOwnedOrThrow(ownerUserId, guideId);
    const content = input.content.trim();

    if (!content) {
      throw new ValidationError('Study guide content must not be blank');
    }
    if (Buffer.byteLength(content, 'utf8') > MAX_GUIDE_CONTENT_BYTES) {
      throw new ValidationError('Study guide content exceeds the 5 MiB limit');
    }

    await this.storage.put(guide.storageKey, content);
    const updated = await this.studyGuidesRepository.touch(guideId);

    logEvent(this.logger, 'log', 'study_guide_content_updated', {
      guideId,
      ownerUserId,
    });

    return updated;
  }

  async delete(ownerUserId: string, guideId: string): Promise<void> {
    const guide = await this.findOwnedOrThrow(ownerUserId, guideId);

    await this.studyGuidesRepository.delete(guideId);
    await this.cleanupKey(guide.storageKey);

    logEvent(this.logger, 'log', 'study_guide_deleted', {
      guideId,
      ownerUserId,
    });
  }

  private async findOwnedMaterialOrThrow(
    ownerUserId: string,
    materialId: string,
  ) {
    const material = await this.materialsRepository.findOwnedById(
      ownerUserId,
      materialId,
    );

    if (!material) {
      throw new NotFoundError('Material not found');
    }

    return material;
  }

  private async findOwnedOrThrow(ownerUserId: string, guideId: string) {
    const guide = await this.studyGuidesRepository.findOwnedById(
      ownerUserId,
      guideId,
    );

    if (!guide) {
      throw new NotFoundError('Study guide not found');
    }

    return guide;
  }

  private async cleanupKey(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      logEvent(this.logger, 'warn', 'study_guide_storage_cleanup_failed', {
        ...errorDetails(error),
      });
    }
  }
}
