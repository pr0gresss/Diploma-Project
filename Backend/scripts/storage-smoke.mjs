// Uses only object storage, not PostgreSQL. Touches one unique temporary key.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { loadEnvFile } from 'node:process';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { createStorageOptions } from '../dist/infrastructure/storage/storage.module.js';

try {
  loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

let disk;
let key;
let attemptedWrite = false;
try {
  assert.equal(
    process.env.STORAGE_DRIVER,
    's3',
    'Set STORAGE_DRIVER=s3 to test R2/S3',
  );
  assert.ok(
    process.env.S3_ENDPOINT,
    'Set S3_ENDPOINT to your R2 S3 API endpoint',
  );
  const options = createStorageOptions(new ConfigService(process.env));
  disk = options.disks.private;
  key = `connection-tests/${randomUUID()}.txt`;
  const content = `Storage connection test ${randomUUID()}`;
  attemptedWrite = true;
  await disk.put(key, content, { contentType: 'text/plain; charset=utf-8' });
  assert.equal(await disk.getText(key), content);
  assert.equal(await disk.exists(key), true);
  const listing = await disk.list({ prefix: key });
  assert.ok(listing.entries.some((entry) => entry.key === key));
  await disk.delete(key);
  attemptedWrite = false;
  assert.equal(await disk.exists(key), false);
  console.log(
    'PASS: private storage write, read, list, delete and missing-object checks',
  );
} catch (error) {
  // Do not print raw configuration, signed requests or credential-bearing errors.
  console.error(
    `Storage check failed (${error.name}). See Documentation/Backend/Storage/R2_SETUP.md for configuration and permission checks.`,
  );
  process.exitCode = 1;
} finally {
  if (disk && attemptedWrite) {
    try {
      await disk.delete(key);
    } catch {
      console.error(
        `Cleanup failed. Remove this test object manually if present: ${key}`,
      );
      process.exitCode = 1;
    }
  }
  await disk?.close?.();
}
