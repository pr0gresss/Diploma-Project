import 'reflect-metadata';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';

// Generate deterministic documentation without connecting to external services.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  'postgresql://docs:docs@127.0.0.1:5432/docs_generation';
process.env.JWT_SECRET = 'documentation-generation-only-not-for-real-tokens';
process.env.JWT_ISSUER = 'ai-study-workspace';
process.env.JWT_AUDIENCE = 'ai-study-workspace-api';
process.env.JWT_ACCESS_TTL = '15m';
process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_ROOT = '.storage';

const { AppModule } = await import('../dist/app.module.js');
const { createOpenApiDocument } = await import('../dist/openapi/openapi.js');
const { rootExamples } = await import('../dist/openapi/openapi.examples.js');
const app = await NestFactory.create(AppModule, { logger: false });
function renderReference(document) {
  const methods = ['get', 'post', 'patch', 'delete', 'put'];
  const operations = Object.entries(document.paths).flatMap(([path, item]) =>
    methods
      .filter((method) => item[method])
      .map((method) => ({ path, method, operation: item[method] })),
  );
  const lines = [
    '# Endpoint reference',
    '',
    'Generated from controller decorators. Do not edit manually; run `npm run docs:generate` from `Backend/`.',
    '',
    '[Documentation home](../README.md) · [OpenAPI JSON](openapi.json)',
    '',
    '| Method | Path | Operation | Authentication |',
    '| --- | --- | --- | --- |',
    ...operations.map(
      ({ path, method, operation }) =>
        `| ${method.toUpperCase()} | \`${path}\` | \`${operation.operationId}\` | ${operation.security?.length === 0 ? 'Public' : 'Bearer JWT'} |`,
    ),
    '',
  ];
  for (const { path, method, operation } of operations) {
    const secured = operation.security?.length !== 0;
    lines.push(
      `## ${method.toUpperCase()} ${path}`,
      '',
      `**${operation.summary}**`,
      '',
      operation.description ?? '',
      '',
      `Operation ID: \`${operation.operationId}\`.`,
      '',
      '### Parameters',
      '',
      '| Location | Name | Required | Type |',
      '| --- | --- | --- | --- |',
    );
    for (const parameter of operation.parameters ?? []) {
      lines.push(
        `| ${parameter.in} | \`${parameter.name}\` | ${parameter.required ? 'yes' : 'no'} | ${parameter.schema?.type ?? 'string'} |`,
      );
    }
    if (secured)
      lines.push('| header | `Authorization` | yes | `Bearer <accessToken>` |');
    if (!secured && !operation.parameters?.length)
      lines.push('| — | None | — | — |');
    const body = operation.requestBody?.content;
    const example = body?.['application/json']?.examples?.typical?.value;
    const multipart = body?.['multipart/form-data'];
    const concretePath = path.replace(
      /\{[^}]+\}/g,
      '11111111-1111-4111-8111-111111111111',
    );
    let command = `curl -i -X ${method.toUpperCase()} "$BASE_URL${concretePath}"`;
    if (secured) command += ' -H "Authorization: Bearer $TOKEN"';
    if (example)
      command += ` -H "Content-Type: application/json" -d '${JSON.stringify(example)}'`;
    if (multipart)
      command +=
        ' -F "file=@lecture.pdf;type=application/pdf" -F "displayName=Lecture notes"';
    lines.push(
      '',
      '### Sample request',
      '',
      'Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.',
      '',
      '```sh',
      command,
      '```',
      '',
    );
    if (body && example)
      lines.push(
        'JSON request body:',
        '',
        '```json',
        JSON.stringify(example, null, 2),
        '```',
        '',
      );
    if (multipart)
      lines.push(
        'Multipart body: required `file` (PDF/DOCX, maximum 10 MiB), optional `displayName`.',
        '',
      );
    lines.push('### Responses', '');
    for (const [status, response] of Object.entries(
      operation.responses ?? {},
    )) {
      lines.push(`#### ${status} — ${response.description}`, '');
      for (const [mediaType, content] of Object.entries(
        response.content ?? {},
      )) {
        const value =
          content.example ?? Object.values(content.examples ?? {})[0]?.value;
        lines.push(`Content-Type: \`${mediaType}\`.`, '');
        if (value !== undefined)
          lines.push(
            `\`\`\`${typeof value === 'string' ? 'text' : 'json'}`,
            typeof value === 'string' ? value : JSON.stringify(value, null, 2),
            '```',
            '',
          );
      }
      if (status === '204') lines.push('No response body.', '');
    }
  }
  return `${lines.join('\n')}\n`;
}
try {
  const document = createOpenApiDocument(app);
  const root = new URL('../../Documentation/Backend/API/', import.meta.url);
  const schema = document.components.schemas.HttpErrorResponse;
  const files = [
    ['reference/openapi.json', document],
    [
      'schemas/http-error.schema.json',
      {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'HttpErrorResponse',
        ...schema,
      },
    ],
    ['examples/root-responses.json', rootExamples],
    ['reference/endpoints.md', renderReference(document)],
  ];
  const check = process.argv.includes('--check');
  for (const [relativePath, content] of files) {
    const target = new URL(relativePath, root);
    const serialized =
      typeof content === 'string'
        ? content
        : `${JSON.stringify(content, null, 2)}\n`;
    if (check) {
      const existing = await readFile(target, 'utf8');
      if (existing.replace(/\r\n/g, '\n') !== serialized) {
        throw new Error(
          `Documentation drift in ${relativePath}; run npm run docs:generate`,
        );
      }
    } else {
      await mkdir(fileURLToPath(new URL('.', target)), { recursive: true });
      await writeFile(target, serialized);
    }
  }
  console.log(
    check
      ? 'PASS: committed OpenAPI, schemas and examples match decorators'
      : 'Generated version-controlled OpenAPI, schemas and examples',
  );
} finally {
  await app.close();
}
