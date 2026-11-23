export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

/** Private object storage abstraction. PostgreSQL stores only the immutable keys. */
export interface ObjectStorage {
  put(key: string, data: Buffer | string): Promise<void>;
  get(key: string): Promise<Buffer>;
  getText(key: string): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
