# Documentation strategy and evaluation

[Documentation home](README.md)

## Strategy and standards

The API reference describes executable controller behavior, not intended
features. The normative machine-readable contract is OpenAPI **3.0.0** JSON,
generated from NestJS `@nestjs/swagger` decorators and shared response models.
Swagger UI serves the same document at runtime. Markdown provides onboarding,
reference explanations, architecture and integration guidance.

The separate error schema uses JSON Schema Draft 7. It is generated from the
same simple OpenAPI component (only compatible primitive/object fields are used
here); complex future schemas must not be assumed automatically interchangeable
between OpenAPI 3.0 and JSON Schema.

## Tools and validation

| Tool | Purpose |
| --- | --- |
| `@nestjs/swagger` | Operation/security/response decorators, OpenAPI generation and Swagger UI |
| Redocly CLI | OpenAPI structural/reference/example validation with the recommended ruleset |
| Node HTTP contract script | Compare published JSON to committed spec and check actual success/auth-error responses |
| Vitest | Existing controller, service and shared-model tests |
| Prettier / oxlint | Consistent TypeScript formatting and linting |
| Git | Reviewable specification, examples, schemas and guide history |

Commands from `Backend/`:

```sh
npm run docs:generate
npm run docs:check
npm run lint
npm test
```

`docs:check` builds the app, verifies generated-file drift, runs Redocly and
starts an ephemeral HTTP server to check documentation delivery, bearer
protection, malformed/missing credentials, a successful authenticated
response and a simulated user-lookup failure (500). The HTTP checks stub external user lookup, not the JWT guard. This
keeps documentation validation independent of PostgreSQL/R2 availability.

Generated examples use placeholders and deterministic response values, never
real access tokens, database passwords or R2 credentials. Real development
sign-in is demonstrated separately by a helper calling `AuthService`.

Redocly's `info-license` rule is disabled explicitly: this private university
project has no declared API redistribution license. All other recommended rules
remain enabled. No paid documentation hosting/tool subscription is required.

## Folder structure and naming

```text
Documentation/Backend/API/
├── README.md
├── architecture.md
├── documentation-strategy.md
├── redocly.yaml
├── reference/
│   ├── openapi.json                  # generated
│   ├── endpoints.md
│   └── authentication-and-errors.md
├── guides/
│   ├── getting-started.md
│   └── authenticated-request.md
├── examples/
│   ├── root.http
│   └── root-responses.json           # generated
└── schemas/
    └── http-error.schema.json        # generated
```

- Markdown filenames are lowercase kebab-case.
- Controller operations use explicit unique camelCase IDs, e.g. `getRootGreeting`.
- Schema/model names use PascalCase, e.g. `HttpErrorResponse`. Resource request
  and response schemas are Zod objects; `ApiEndpoint` derives OpenAPI request
  shapes from those same validation schemas.
- JSON fields use camelCase, matching actual runtime serialization.
- Environment variables use uppercase snake case.
- Every endpoint reference identifies its controller/handler, operation ID,
  parameters, media types, examples, errors and status codes.
- Relative Markdown links work in the repository without a documentation server.
- Fenced examples identify their language; response headers show meaningful
  semantics, not unstable values such as content length or timestamps.

## Versioning and traceability

`info.version` is **2.0.0**, the version of this implemented documentation
contract. It is independent of the backend package's scaffold version and the
OpenAPI language version. There is currently no `/v1` URL prefix.

Version changes use semantic intent:

- Patch: corrections/examples that do not change the interface.
- Minor: backward-compatible new operations or optional fields.
- Major: breaking paths, authentication requirements, media types or required fields.

Any breaking route version strategy must be designed before feature API release,
not silently inferred from the documentation version.

Traceability:

```text
src/app.controller.ts decorators
  + src/openapi/http-error.response.ts
  + src/openapi/openapi.examples.ts
  + src/openapi/openapi.ts
  + src/openapi/resource.schemas.ts and resource.examples.ts
  + src/common/http/request.schemas.ts
    → scripts/export-openapi.mjs
    → committed OpenAPI / schema / response fixtures
    → Redocly + scripts/check-openapi.mjs
```

When adding a controller operation:

1. Implement its business/transport behavior and authentication rules.
2. Add explicit `ApiTags`, security, `ApiOperation`, parameter/body schemas and
   response decorators for success and meaningful failures.
3. Provide representative success, validation and ownership/access examples.
4. Extend Markdown reference and the integration tutorial.
5. Regenerate the contract and commit all affected artifacts together.
6. Run `docs:check`, lint and appropriate controller/integration tests.

## Publication

The documentation is immediately accessible as a Git-hosted Markdown repository,
through `/docs/` Swagger UI, and via JSON/YAML downloads. The JSON file can be
opened in Swagger Editor or supplied to client tooling. No external publishing
account or paid service is needed.

The root Compose setup serves Swagger through `/api/docs/` on the frontend
origin. In production, decide whether documentation should be private or
disabled; currently the documentation routes themselves are public.

## Evaluation and known limitations

- **Endpoint coverage:** all 34 controller operations are decorated. The
  generated endpoint reference includes parameters, request examples, response
  examples and status codes. Internal worker methods intentionally have no routes.
- **Authentication onboarding:** public HTTP registration/sign-in are available;
  a real HTTP workflow replaces the previous local-helper requirement.
- **Response formats:** the starter success response is text/html, not JSON.
  Future resource endpoints should define explicit JSON DTOs.
- **Errors:** the global domain-error filter maps validation, ownership,
  conflict and storage failures. Framework authentication errors retain their
  existing envelope; optional properties are documented.
- **Testing:** HTTP contract checks cover 200/401/500 and the declared schema;
  production connectivity, all expiry/signature variations and infrastructure
  outages require broader integration tests. Redocly validation does not prove
  server correctness.
- **Future integrations:** the extraction worker and browser API integration are
  not implemented. OAuth-backed quiz generation is now synchronous and owner-
  scoped; live consent and inference require user setup. A durable background AI
  worker and per-user OAuth account management remain future work.
- **Operations:** there is no application health endpoint, public deployment
  verification, HTTP rate limiting, or CI-hosted documentation publishing yet.
- **Security:** existing dependency advisories must still be resolved before
  production release. Documentation generation does not resolve those issues.
