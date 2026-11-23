import { z } from 'zod';

// Compose supplies empty strings for unset optional variables.
const optionalText = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).optional(),
);
const optionalUrl = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().url().optional(),
);

/**
 * Startup validation. A missing or malformed variable stops the application
 * before it accepts traffic, instead of failing later on a request.
 */
const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    JWT_SECRET: z
      .string()
      .min(32, 'JWT_SECRET must contain at least 32 characters (256 bits)'),
    JWT_ISSUER: z.string().min(1).default('ai-study-workspace'),
    JWT_AUDIENCE: z.string().min(1).default('ai-study-workspace-api'),
    JWT_ACCESS_TTL: z.string().min(1).default('15m'),
    STORAGE_ROOT: z.string().min(1).default('.storage'),
    TIKA_URL: optionalUrl.refine((value) => {
      if (!value) return true;
      const url = new URL(value);
      return (
        ['http:', 'https:'].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        url.pathname === '/'
      );
    }, 'TIKA_URL must be an HTTP(S) service origin without credentials'),
    TIKA_TIMEOUT_MS: z.coerce.number().int().min(1).max(300000).default(60000),
    PROCESSING_WORKER_ENABLED: z.enum(['true', 'false']).default('true'),
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    S3_BUCKET: optionalText,
    S3_REGION: z.string().min(1).default('auto'),
    S3_ENDPOINT: optionalUrl,
    AWS_ACCESS_KEY_ID: optionalText,
    AWS_SECRET_ACCESS_KEY: optionalText,
    AWS_SESSION_TOKEN: optionalText,
    LLM_BASE_URL: z
      .string()
      .url()
      .default('https://api.openai.com/v1')
      .refine((value) => {
        const url = new URL(value);
        return (
          ['http:', 'https:'].includes(url.protocol) &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash
        );
      }, 'Use an HTTP(S) API base URL without credentials, query or fragment'),
    LLM_MODEL: optionalText,
    LLM_API_KEY: optionalText,
    LLM_TIMEOUT_MS: z.coerce.number().int().min(1).max(300000).default(45000),
    LLM_MAX_CONTEXT_CHARS: z.coerce
      .number()
      .int()
      .min(1)
      .max(1000000)
      .default(60000),
    LLM_MAX_OUTPUT_TOKENS: z.coerce
      .number()
      .int()
      .min(1)
      .max(131072)
      .default(8192),
  })
  .superRefine((environment, context) => {
    if (environment.STORAGE_DRIVER === 's3') {
      for (const key of [
        'S3_BUCKET',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
      ] as const) {
        if (!environment[key]) {
          context.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=s3`,
          });
        }
      }
      if (environment.S3_ENDPOINT) {
        const endpoint = new URL(environment.S3_ENDPOINT);
        if (
          !['https:', 'http:'].includes(endpoint.protocol) ||
          endpoint.username ||
          endpoint.password ||
          endpoint.search ||
          endpoint.hash ||
          endpoint.pathname !== '/'
        ) {
          context.addIssue({
            code: 'custom',
            path: ['S3_ENDPOINT'],
            message:
              'S3_ENDPOINT must be an HTTP(S) service origin without credentials, bucket path or query',
          });
        }
        if (
          endpoint.hostname.endsWith('.r2.cloudflarestorage.com') &&
          (endpoint.protocol !== 'https:' || environment.S3_REGION !== 'auto')
        ) {
          context.addIssue({
            code: 'custom',
            path: ['S3_ENDPOINT'],
            message: 'Cloudflare R2 requires HTTPS and S3_REGION=auto',
          });
        }
      }
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const result = environmentSchema.safeParse(values);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${problems}`);
  }

  return result.data;
}
