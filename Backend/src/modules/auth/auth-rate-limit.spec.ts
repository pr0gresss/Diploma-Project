import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthModule } from './auth.module.js';
import { AuthService } from './auth.service.js';
import { UsersRepository } from '../users/users.repository.js';

describe('Public authentication request limits', () => {
  let app: INestApplication;
  const auth = {
    register: vi.fn().mockResolvedValue({}),
    signIn: vi.fn().mockResolvedValue({}),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_SECRET: 'rate-limit-test-only-secret-32-characters',
              JWT_ISSUER: 'test',
              JWT_AUDIENCE: 'test',
              JWT_ACCESS_TTL: '15m',
            }),
          ],
        }),
        AuthModule,
      ],
    })
      .overrideProvider(UsersRepository)
      .useValue({})
      .overrideProvider(AuthService)
      .useValue(auth)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => app?.close());
  it('allows five registrations and then rejects the next before hashing', async () => {
    for (let i = 0; i < 5; i++)
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({})
        .expect(201);
    const blocked = await request(app.getHttpServer())
      .post('/auth/register')
      .send({})
      .expect(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(auth.register).toHaveBeenCalledTimes(5);
  });
  it('gives sign-in its own limit and ignores spoofed forwarded addresses', async () => {
    for (let i = 0; i < 10; i++)
      await request(app.getHttpServer())
        .post('/auth/sign-in')
        .set('X-Forwarded-For', `192.0.2.${i}`)
        .send({})
        .expect(200);
    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .set('X-Forwarded-For', '192.0.2.200')
      .send({})
      .expect(429);
    expect(auth.signIn).toHaveBeenCalledTimes(10);
  });
});
