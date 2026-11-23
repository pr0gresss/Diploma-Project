// Development bridge only, until HTTP authentication controllers are implemented.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { AuthService } from '../dist/modules/auth/auth.service.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('The documentation token helper is disabled in production');
}
if (!process.env.DOCS_EMAIL || !process.env.DOCS_PASSWORD) {
  throw new Error(
    'Set DOCS_EMAIL and DOCS_PASSWORD for an existing development account',
  );
}
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
});
try {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The documentation token helper is disabled in production');
  }
  const result = await app.get(AuthService).signIn({
    email: process.env.DOCS_EMAIL,
    password: process.env.DOCS_PASSWORD,
  });
  // Intentionally outputs only the requested short-lived development access token.
  process.stdout.write(`${result.accessToken}\n`);
} catch {
  console.error(
    'Token creation failed. Check the development database, credentials and backend environment.',
  );
  process.exitCode = 1;
} finally {
  await app.close();
}
