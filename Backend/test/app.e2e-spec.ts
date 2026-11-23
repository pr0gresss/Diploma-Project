import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { setupOpenApi } from './../src/openapi/openapi.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupOpenApi(app);
    await app.init();
  });

  it('/ (GET) requires bearer authentication', () => {
    return request(app.getHttpServer()).get('/').expect(401).expect({
      message: 'Unauthorized',
      statusCode: 401,
      errorCode: 'missing_credentials',
    });
  });

  it('/docs-json (GET) exposes the documented security requirements', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    expect(response.body.paths['/'].get.security).toEqual([{ bearerAuth: [] }]);
  });

  afterEach(async () => {
    await app.close();
  });
});
