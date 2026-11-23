import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  LocalDisk,
  S3Disk,
  StorageModule as NestStorageModule,
  type StorageModuleOptions,
} from '@nestjs/storage';
import { LocalObjectStorageService } from './local-object-storage.service.js';
import { OBJECT_STORAGE } from './object-storage.interface.js';

export function createStorageOptions(
  config: ConfigService,
): StorageModuleOptions {
  const driver = config.get<string>('STORAGE_DRIVER') ?? 'local';

  if (driver === 's3') {
    // Resolve credentials through Nest config too, not just process.env, so
    // validated environment values and injected test configuration behave alike.
    return {
      default: 'private',
      disks: {
        private: new S3Disk({
          bucket: config.getOrThrow<string>('S3_BUCKET'),
          region: config.getOrThrow<string>('S3_REGION'),
          endpoint: config.get<string>('S3_ENDPOINT') || undefined,
          credentials: {
            accessKeyId: config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
            secretAccessKey: config.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
            sessionToken: config.get<string>('AWS_SESSION_TOKEN') || undefined,
          },
          timeout: '30s',
          // S3Disk requires byte-for-byte bodies and rejects Content-Encoding.
          // R2 can compress text responses when fetch advertises gzip/br.
          fetch: (input, init) => {
            const headers = new Headers(init?.headers);
            headers.set('Accept-Encoding', 'identity');
            return globalThis.fetch(input, { ...init, headers });
          },
        }),
      },
    };
  }

  return {
    default: 'private',
    disks: {
      private: new LocalDisk({
        root: config.getOrThrow<string>('STORAGE_ROOT'),
      }),
    },
  };
}

@Global()
@Module({
  imports: [
    NestStorageModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createStorageOptions,
    }),
  ],
  providers: [
    LocalObjectStorageService,
    { provide: OBJECT_STORAGE, useExisting: LocalObjectStorageService },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
