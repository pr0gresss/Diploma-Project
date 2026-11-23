import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { resourceSchemas } from './resource.schemas.js';
import { apiSchema } from './api-endpoint.decorator.js';
import { HttpErrorResponse } from './http-error.response.js';
import { resourceExamples } from './resource.examples.js';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('AI Study Workspace API')
    .setDescription(
      'Authenticated study workspace API: accounts, workspaces, uploaded materials, processing status, ' +
        'Markdown guides, quizzes, graded attempts and progress. Sign in or register to obtain an access token. ' +
        'Background text extraction runs when TIKA_URL is configured. Content-creation endpoints persist supplied content.',
    )
    .setVersion('2.0.0')
    .setContact(
      'Project maintainers',
      'https://github.com/pr0gresss/Diploma-Project',
      '',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Use POST /auth/sign-in or POST /auth/register, then send Authorization: Bearer <accessToken>. No refresh tokens are issued.',
      },
      'bearerAuth',
    )
    .addTag(
      'System',
      'Implemented application bootstrap endpoint. Not a readiness or liveness probe.',
    )
    .addServer('/', 'Direct backend; same origin as the specification')
    .addServer(
      '/api',
      'Frontend reverse proxy; select this in proxied Swagger UI',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [HttpErrorResponse],
  });
  document.components ??= {};
  document.components.schemas ??= {};
  for (const [name, schema] of Object.entries(resourceSchemas)) {
    document.components.schemas[name] = {
      ...apiSchema(schema),
      example: resourceExamples[name as keyof typeof resourceExamples],
    };
  }
  for (const [page, item] of Object.entries({
    WorkspacePage: 'Workspace',
    MaterialPage: 'Material',
    StudyGuidePage: 'StudyGuide',
    QuizPage: 'Quiz',
    AttemptPage: 'Attempt',
    ProgressReport: 'QuizProgress',
  })) {
    const schema = document.components.schemas[
      page
    ] as import('@nestjs/swagger').SchemaObject;
    schema.properties!.items = {
      type: 'array',
      items: { $ref: `#/components/schemas/${item}` },
    };
  }
  return document;
}

export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup('docs', app, () => createOpenApiDocument(app), {
    customSiteTitle: 'AI Study Workspace API',
    jsonDocumentUrl: 'docs-json',
    yamlDocumentUrl: 'docs-yaml',
    swaggerOptions: {
      persistAuthorization: false,
      displayRequestDuration: true,
      docExpansion: 'list',
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
}
