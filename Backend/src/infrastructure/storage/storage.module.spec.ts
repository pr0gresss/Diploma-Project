import { ConfigService } from '@nestjs/config';
import { S3Disk } from '@nestjs/storage';
import { createStorageOptions } from './storage.module.js';

describe('R2 storage configuration', () => {
  const values = {
    STORAGE_DRIVER: 's3',
    S3_BUCKET: 'private-study-files',
    S3_REGION: 'auto',
    S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
    AWS_ACCESS_KEY_ID: 'test-access-key',
    AWS_SECRET_ACCESS_KEY: 'test-secret-key',
    AWS_SESSION_TOKEN: '',
  };

  afterEach(() => vi.restoreAllMocks());

  it('requests uncompressed S3 responses so extracted text remains readable', async () => {
    const text = 'Extracted document text. '.repeat(300);
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (_input, init) => {
        const identity =
          new Headers(init?.headers).get('accept-encoding') === 'identity';
        return new Response(text, {
          headers: {
            'Content-Length': String(Buffer.byteLength(text)),
            ...(identity ? {} : { 'Content-Encoding': 'gzip' }),
          },
        });
      });
    const disk = createStorageOptions(new ConfigService(values)).disks!.private;
    expect(await disk.getText('materials/test/extracted.txt')).toBe(text);
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('accept-encoding')).toBe('identity');
    expect(headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 /);
  });

  it('uses configured credentials and a private R2 disk', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { 'Content-Length': '0', ETag: '"test"' },
      }),
    );
    const options = createStorageOptions(new ConfigService(values));
    const disk = options.disks?.private;
    expect(disk).toBeInstanceOf(S3Disk);
    expect(options.default).toBe('private');
    expect(await disk!.exists('test.txt')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [request] = fetchMock.mock.calls[0];
    const url = new URL(
      request instanceof Request ? request.url : String(request),
    );
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toContain('r2.cloudflarestorage.com');
    expect(() => disk!.url('test.txt')).toThrow();
  });

  it('rejects missing credentials instead of selecting local storage', () => {
    const { AWS_SECRET_ACCESS_KEY: _secret, ...missingSecret } = values;
    expect(() =>
      createStorageOptions(new ConfigService(missingSecret)),
    ).toThrow();
  });
});
