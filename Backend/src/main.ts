import { ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupOpenApi } from './openapi/openapi.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureHttp } from './common/http/configure-http.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  configureHttp(app);
  app.enableCors({ origin: 'http://localhost:4200' });

  app.useLogger(
    new ConsoleLogger({
      json: false,
      flattenParams: true,
      redact: ['password', 'passwordHash', 'accessToken', 'refreshToken'],
    }),
  );
  app.enableShutdownHooks();

  setupOpenApi(app);

  const config = app.get(ConfigService);
  await app.listen(config.get<number>('PORT', 3000));
}

await bootstrap();
