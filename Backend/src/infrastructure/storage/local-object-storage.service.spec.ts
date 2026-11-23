import { InMemoryDisk } from '@nestjs/storage';
import { LocalObjectStorageService } from './local-object-storage.service.js';
import { StorageError } from '../../common/errors/index.js';

describe('LocalObjectStorageService', () => {
  it('round-trips content through a first-party disk', async () => {
    const service = new LocalObjectStorageService(new InMemoryDisk());
    expect(await service.exists('notes/content.md')).toBe(false);
    await service.put('notes/content.md', '# Notes');
    expect(await service.exists('notes/content.md')).toBe(true);
    expect(await service.getText('notes/content.md')).toBe('# Notes');
    expect(await service.get('notes/content.md')).toEqual(
      Buffer.from('# Notes'),
    );
    await service.delete('notes/content.md');
    await service.delete('notes/content.md');
    await expect(service.get('notes/content.md')).rejects.toBeInstanceOf(
      StorageError,
    );
    await expect(service.getText('notes/content.md')).rejects.toBeInstanceOf(
      StorageError,
    );
  });
  it('maps disk failures and refuses traversal', async () => {
    const service = new LocalObjectStorageService(new InMemoryDisk());
    await expect(service.put('../secret', 'test')).rejects.toBeInstanceOf(
      StorageError,
    );
    await expect(service.get('../secret')).rejects.toBeInstanceOf(StorageError);
    await expect(service.getText('../secret')).rejects.toBeInstanceOf(
      StorageError,
    );
    await expect(service.delete('../secret')).rejects.toBeInstanceOf(
      StorageError,
    );
    await expect(service.exists('../secret')).rejects.toBeInstanceOf(
      StorageError,
    );
  });
});
