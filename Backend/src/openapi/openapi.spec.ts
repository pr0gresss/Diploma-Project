import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppController } from '../app.controller.js';
import { AppService } from '../app.service.js';
import { createOpenApiDocument, setupOpenApi } from './openapi.js';
import { rootExamples } from './openapi.examples.js';

describe('OpenAPI documentation', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();
    app = module.createNestApplication();
    setupOpenApi(app);
    await app.init();
  });
  afterAll(async () => app.close());

  it('documents every current endpoint with explicit operation metadata', () => {
    const document = createOpenApiDocument(app);
    expect(Object.keys(document.paths)).toEqual(['/']);
    const operation = document.paths['/'].get!;
    expect(operation).toMatchObject({
      operationId: 'getRootGreeting',
      summary: expect.any(String),
      description: expect.any(String),
      tags: ['System'],
      security: [{ bearerAuth: [] }],
    });
    expect(Object.keys(operation.responses!)).toEqual(['200', '401', '500']);
    expect(document.components?.securitySchemes?.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
  });

  it('documents actual media types and optional error fields', () => {
    const document = createOpenApiDocument(app);
    const operation = document.paths['/'].get!;
    const success = operation.responses!['200'];
    expect(success).toMatchObject({
      content: { 'text/html': { schema: { type: 'string' } } },
    });
    const error = document.components?.schemas?.HttpErrorResponse;
    expect(error).toMatchObject({
      type: 'object',
      required: ['message', 'statusCode'],
    });
    expect(rootExamples.missingCredentials.statusCode).toBe(401);
    expect(rootExamples.internalError.statusCode).toBe(500);
  });
});
