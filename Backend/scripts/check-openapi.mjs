import 'reflect-metadata';
process.env.PROCESSING_WORKER_ENABLED = 'false';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { TokenService } from '@nestjs/authentication';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  'postgresql://docs:docs@127.0.0.1:5432/docs_contract_test';
process.env.JWT_SECRET = 'documentation-contract-test-only-not-for-real-tokens';
process.env.JWT_ISSUER = 'ai-study-workspace';
process.env.JWT_AUDIENCE = 'ai-study-workspace-api';
process.env.JWT_ACCESS_TTL = '15m';
process.env.STORAGE_DRIVER = 'local';
const { AppModule } = await import('../dist/app.module.js');
const { setupOpenApi } = await import('../dist/openapi/openapi.js');
const { UsersRepository } =
  await import('../dist/modules/users/users.repository.js');
const specification = JSON.parse(
  await readFile(
    new URL(
      '../../Documentation/Backend/API/reference/openapi.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const examples = JSON.parse(
  await readFile(
    new URL(
      '../../Documentation/Backend/API/examples/root-responses.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const app = await NestFactory.create(AppModule, { logger: false });
// Isolate external data access, while testing real HTTP routing, JWT signing,
// bearer validation and Swagger serving. This is not a database integration test.
const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'docs@example.com',
  createdAt: new Date(),
  updatedAt: new Date(),
};
app.get(UsersRepository).findById = async (id) =>
  id === user.id ? user : null;
setupOpenApi(app);
try {
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const documentResponse = await fetch(`${base}/docs-json`);
  assert.equal(documentResponse.status, 200);
  const document = await documentResponse.json();
  assert.deepEqual(document, specification);
  const operations = Object.entries(document.paths).flatMap(([path, item]) =>
    ['get', 'post', 'patch', 'delete']
      .filter((method) => item[method])
      .map((method) => ({ path, method, ...item[method] })),
  );
  assert.equal(operations.length, 35);
  assert.equal(
    new Set(operations.map((operation) => operation.operationId)).size,
    operations.length,
  );
  for (const operation of operations) {
    assert.ok(operation.summary);
    assert.ok(operation.description);
    assert.ok(operation.tags?.length);
    if (operation.path.startsWith('/auth/'))
      assert.deepEqual(operation.security, []);
    else assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
  }
  assert.ok(
    !operations.some((operation) =>
      /claim|completeExtraction|failExtraction/.test(operation.operationId),
    ),
  );
  const upload = document.paths['/workspaces/{workspaceId}/materials'].post;
  const uploadBody = upload.requestBody.content['multipart/form-data'].schema;
  assert.equal(upload.requestBody.required, true);
  assert.ok(uploadBody.required.includes('file'));
  assert.deepEqual(
    {
      type: uploadBody.properties.file.type,
      format: uploadBody.properties.file.format,
    },
    { type: 'string', format: 'binary' },
  );
  assert.equal(uploadBody.properties.displayName.type, 'string');
  const ui = await fetch(`${base}/docs/`);
  assert.equal(ui.status, 200);
  assert.match(await ui.text(), /swagger-ui/i);
  const yaml = await fetch(`${base}/docs-yaml`);
  assert.equal(yaml.status, 200);
  assert.match(await yaml.text(), /openapi:/);
  const missing = await fetch(base);
  assert.equal(missing.status, 401);
  assert.deepEqual(await missing.json(), examples.missingCredentials);
  assert.equal(
    missing.headers.get('www-authenticate'),
    'Bearer realm="ai-study-workspace"',
  );
  const malformed = await fetch(base, {
    headers: { Authorization: 'Bearer not-a-jwt' },
  });
  assert.equal(malformed.status, 401);
  assert.deepEqual(await malformed.json(), examples.malformedToken);
  const tokens = await app
    .get(TokenService)
    .issue(user.id, { method: 'password' });
  const success = await fetch(base, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  assert.equal(success.status, 200);
  assert.match(success.headers.get('content-type'), /^text\/html/);
  assert.equal(await success.text(), examples.success);
  const deleted = await app
    .get(TokenService)
    .issue('22222222-2222-4222-8222-222222222222');
  const deletedResponse = await fetch(base, {
    headers: { Authorization: `Bearer ${deleted.accessToken}` },
  });
  assert.equal(deletedResponse.status, 401);
  app.get(UsersRepository).findById = async () => {
    throw new Error('Simulated internal user lookup failure');
  };
  const unavailable = await fetch(base, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  assert.equal(unavailable.status, 500);
  assert.deepEqual(await unavailable.json(), examples.internalError);
  assert.equal(document.paths['/'].get.operationId, 'getRootGreeting');
  assert.deepEqual(document.paths['/'].get.security, [{ bearerAuth: [] }]);
  console.log(
    'PASS: OpenAPI drift, Swagger UI/JSON/YAML, documented 200/401/500 responses and deleted-account rejection',
  );
} finally {
  await app.close();
}
