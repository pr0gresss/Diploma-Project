import { validateEnvironment } from './environment.js';

describe('validateEnvironment', () => {
  const base = {
    DATABASE_URL: 'postgresql://localhost/study',
    JWT_SECRET: 'a'.repeat(32),
  };
  it('provides validated defaults', () => {
    expect(validateEnvironment(base)).toMatchObject({
      PORT: 3000,
      STORAGE_DRIVER: 'local',
      JWT_ACCESS_TTL: '15m',
    });
    expect(validateEnvironment({ ...base, PORT: '4000' })).toMatchObject({
      PORT: 4000,
    });
  });
  it('ignores legacy OAuth settings when configuring the active LLM provider', () => {
    expect(() =>
      validateEnvironment({
        ...base,
        OPENAI_OAUTH_ENABLED: 'true',
        OPENAI_OAUTH_OWNER_USER_ID: '',
        LLM_MODEL: 'test-model',
        LLM_API_KEY: 'test-key',
      }),
    ).not.toThrow();
  });
  it.each([
    {},
    { ...base, PORT: 0 },
    { ...base, JWT_SECRET: 'short' },
    { ...base, STORAGE_DRIVER: 's3' },
  ])('rejects invalid configuration %#', (values) => {
    expect(() => validateEnvironment(values)).toThrow(
      'Invalid environment configuration',
    );
  });
  it('accepts S3 with a bucket', () => {
    expect(
      validateEnvironment({
        ...base,
        STORAGE_DRIVER: 's3',
        S3_BUCKET: 'private',
        AWS_ACCESS_KEY_ID: 'test-access-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret-key',
      }),
    ).toMatchObject({ S3_BUCKET: 'private' });
  });

  it('allows empty optional Compose variables with local storage', () => {
    expect(
      validateEnvironment({
        ...base,
        S3_BUCKET: '',
        S3_ENDPOINT: '',
        AWS_ACCESS_KEY_ID: '',
        AWS_SECRET_ACCESS_KEY: '',
        AWS_SESSION_TOKEN: '',
      }),
    ).toMatchObject({ STORAGE_DRIVER: 'local' });
  });

  const r2 = {
    ...base,
    STORAGE_DRIVER: 's3',
    S3_BUCKET: 'private',
    S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
    AWS_ACCESS_KEY_ID: 'test-access-key',
    AWS_SECRET_ACCESS_KEY: 'test-secret-key',
  };
  it.each([
    { ...r2, AWS_ACCESS_KEY_ID: '' },
    { ...r2, AWS_SECRET_ACCESS_KEY: '' },
    { ...r2, S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com/bucket' },
    { ...r2, S3_ENDPOINT: 'https://user:secret@example.com' },
    { ...r2, S3_ENDPOINT: 'ftp://example.com' },
    { ...r2, S3_ENDPOINT: 'http://account.r2.cloudflarestorage.com' },
    { ...r2, S3_REGION: 'us-east-1' },
  ])('rejects invalid R2 credentials/configuration %#', (values) => {
    expect(() => validateEnvironment(values)).toThrow(
      'Invalid environment configuration',
    );
  });
  it('accepts private R2 configuration without echoing secrets', () => {
    expect(validateEnvironment(r2)).toMatchObject({
      STORAGE_DRIVER: 's3',
      S3_REGION: 'auto',
    });
  });
});
