# AI Study Workspace API documentation

This is the reference for the **implemented HTTP API**, not a proposed contract.
Specification release: **2.0.0**, using **OpenAPI 3.0.0**.

The API exposes 34 operations across authentication, profiles, workspaces,
materials, processing jobs, guides, quizzes, attempts and progress. Registration
and sign-in are public; all other controller operations require a bearer JWT.
Worker mutation methods remain internal.

Questions support radio-button `SINGLE_CHOICE`, dropdown `SELECT`, and checkbox
`MULTI_SELECT`. Quiz generation uses a configurable
[OpenAI-compatible provider or Codex gateway](../AI/LLM_CONFIGURATION.md).

## Start here

1. [Getting started](guides/getting-started.md)
2. [Integration tutorial: obtain a development token and call the API](guides/authenticated-request.md)
3. [Endpoint reference](reference/endpoints.md)
4. [Authentication and errors](reference/authentication-and-errors.md)
5. [Architecture and module status](architecture.md)
6. [Documentation strategy, maintenance and limitations](documentation-strategy.md)

## Reference files

| File | Purpose |
| --- | --- |
| [`reference/openapi.json`](reference/openapi.json) | Complete machine-readable specification of current controller routes |
| [`schemas/http-error.schema.json`](schemas/http-error.schema.json) | Standalone JSON Schema for the current HTTP error envelope |
| [`examples/root.http`](examples/root.http) | Success and edge-case requests for an HTTP client |
| [`examples/workflow.http`](examples/workflow.http) | Authentication, workspace and learning workflow requests |
| [`examples/root-responses.json`](examples/root-responses.json) | Generated response fixtures shared with the specification and contract checks |
| [`redocly.yaml`](redocly.yaml) | OpenAPI lint configuration |

## Interactive documentation

| Resource | Direct backend | Frontend reverse proxy |
| --- | --- | --- |
| Swagger UI | http://localhost:3000/docs/ | http://localhost:8080/api/docs/ |
| OpenAPI JSON | http://localhost:3000/docs-json | http://localhost:8080/api/docs-json |
| OpenAPI YAML | http://localhost:3000/docs-yaml | http://localhost:8080/api/docs-yaml |

Swagger routes themselves are served by the Swagger integration, outside
application-controller authentication. They do not return access tokens. The
OpenAPI specification describes the application API, not its documentation UI.

In Swagger, select **Direct backend** when visiting port 3000, or **Frontend
reverse proxy** when visiting port 8080. The proxy strips `/api/` before
forwarding requests. The frontend does not yet implement an API workflow.

## Validate and regenerate

From `Backend/`:

```sh
npm run docs:generate
npm run docs:check
```

`docs:check` checks for differences between the committed files and controller
decorators, runs Redocly's recommended OpenAPI rules, and runs HTTP contract
checks for Swagger serving and authenticated/unauthenticated responses. It
does not need PostgreSQL, R2, or real credentials: external user lookup is
replaced only inside the contract-test process.

Generated files are committed so reviewers and client developers can use the
contract without starting NestJS. Do not hand-edit generated reference/schema/
response files; change their source decorators/models and regenerate them.
