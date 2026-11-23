# Backend development

Swagger UI: http://localhost:3000/docs (or
http://localhost:8080/api/docs through the frontend proxy).
OpenAPI JSON: http://localhost:3000/docs-json.
OpenAPI YAML: http://localhost:3000/docs-yaml.
Only implemented controller routes are listed. When using "Try it out" through
the frontend proxy, select the `/api` server in Swagger.

See [`API documentation`](API/README.md) for the version-controlled
specification, endpoint examples, authentication tutorial and documentation report.
Run `npm run docs:generate` to update artifacts and `npm run docs:check` to validate
them with Redocly and HTTP contract checks.

Run from the repository's `Backend/` folder:

| Command | Description |
| --- | --- |
| `npm run start:dev` | Watch mode on http://localhost:3000 |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run the compiled app |
| `npm run lint` | oxlint (type-aware) |
| `npm test` | Vitest unit tests |
| `npm run test:services` | Database-backed service smoke test; creates and cleans up its own disposable account |
| `npm run test:http` | Database-backed HTTP workflow test using temporary local storage and disposable accounts |
| `npm run test:storage` | Real R2/S3 connection check using one temporary object; no database required |
| `npm run test:e2e` | Vitest e2e tests |
| `npm run prisma:generate` | Regenerate the Prisma client |
| `npm run prisma:migrate` | Apply pending migrations (`prisma migrate deploy`) |
| `npm run prisma:migrate:status` | Show applied/pending migration status |
| `npm run prisma:studio` | Open Prisma Studio |


Extraction checks: `npm run test:tika` uses isolated local storage; `npm run test:tika:r2` uses the configured R2 bucket.

`npm run test:processing` exercises actual PostgreSQL queue claims, stale-job
recovery, and deletion locks in a disposable schema. The configured database
login needs CREATE SCHEMA permission. The test does not claim application jobs
or change the application's tables. Service/HTTP/e2e/documentation utilities
disable the worker before importing the application module.

[Backend reference](README.md)
