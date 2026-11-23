import { Injectable, Logger } from '@nestjs/common';
import { StorageDisk, StorageFileNotFoundError } from '@nestjs/storage';
import { StorageError } from '../../common/errors/index.js';
import type { ObjectStorage } from './object-storage.interface.js';

/**
 * Adapts the first-party `@nestjs/storage` disk to the small object-storage
 * contract the domain services use. The adapter maps storage failures to the
 * application error hierarchy, so a missing object cannot leak an HTTP status
 * from a library through a controller.
 */
@Injectable()
export class LocalObjectStorageService implements ObjectStorage {
  private readonly logger = new Logger(LocalObjectStorageService.name);

  constructor(private readonly disk: StorageDisk) {}

  async put(key: string, data: Buffer | string): Promise<void> {
    try {
      await this.disk.put(key, data);
    } catch (error) {
      this.logFailure('write', key, error);
      throw new StorageError('The file could not be stored', { key }, error);
    }
  }

  async get(key: string): Promise<Buffer> {
    try {
      return await this.disk.getBuffer(key);
    } catch (error) {
      if (error instanceof StorageFileNotFoundError) {
        throw new StorageError(
          'The stored object does not exist',
          { key },
          error,
        );
      }
      this.logFailure('read', key, error);
      throw new StorageError(
        'The stored file could not be read',
        { key },
        error,
      );
    }
  }

  async getText(key: string): Promise<string> {
    try {
      return await this.disk.getText(key);
    } catch (error) {
      if (error instanceof StorageFileNotFoundError) {
        throw new StorageError(
          'The stored object does not exist',
          { key },
          error,
        );
      }
      this.logFailure('read', key, error);
      throw new StorageError(
        'The stored file could not be read',
        { key },
        error,
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.disk.delete(key);
    } catch (error) {
      this.logFailure('delete', key, error);
      throw new StorageError(
        'The stored file could not be deleted',
        { key },
        error,
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      return await this.disk.exists(key);
    } catch (error) {
      this.logFailure('check', key, error);
      throw new StorageError(
        'The storage object could not be checked',
        { key },
        error,
      );
    }
  }

  private logFailure(operation: string, key: string, error: unknown): void {
    this.logger.error('Storage operation failed', {
      operation,
      key,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
}
