import type { NestExpressApplication } from '@nestjs/platform-express';

/** Shared by production bootstrap and HTTP integration checks. */
export function configureHttp(app: NestExpressApplication): void {
  // Room for a 5 MiB guide plus JSON escaping/envelope; service enforces content size.
  app.useBodyParser('json', { limit: '12mb' });
}
