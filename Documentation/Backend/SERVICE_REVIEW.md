# Service layer review

## Implemented

Services and repositories live under `src/modules/`: auth, users, workspaces,
materials, processing jobs, study guides, quizzes, attempts and progress.

- PostgreSQL is the source of truth; Prisma repositories perform database access.
- Services validate business rules and raise domain errors rather than HTTP errors.
- User-facing reads are scoped to the authenticated user's resources.
- Quizzes omit correct-answer flags and explanations when fetched for taking.
- Attempt counters are graded server-side; PostgreSQL calculates the score.
- Invalid legacy quiz correctness is rejected before any attempt is committed.
- Object storage uses `@nestjs/storage`, with local and S3/R2 disk configuration.
- Extraction completion publishes stored text and material/job states together.
- Deletions preserve assessment history and clean up eligible private objects.
- Feature controllers, shared Zod HTTP schemas, domain-error mapping and Swagger
  documentation are implemented; see [API documentation](API/README.md).

## Verification

Run from `Backend/`:

```sh
npm run build
npm run lint
npm test
npm run test:cov
npm run test:services
npm run test:http
npm run docs:check
```

The database service smoke test uses the actual database and private storage. It
creates a disposable account, exercises the resource lifecycle, checks isolation
and history restrictions, then removes only its own account, history and files.
It does not claim seeded or other users' queued jobs.

Unit coverage includes untested application source files, excluding generated
Prisma code and test files. Minimum statement, branch and line coverage is 70%.
The HTML report is generated at `coverage/index.html`.

## Not implemented yet

- A durable background AI worker and AI guide generation. Quiz generation now
  supports synchronous owner-scoped OpenAI OAuth calls; live setup/consent is
  required. Manual guide and quiz creation still accept supplied content.
- Durable reconciliation after ambiguous database commits or storage cleanup failures.
- Production deployment verification and complete repository test coverage.

The smoke test supplies extracted text directly to the completion service; its
PDF fixture is not a test of an actual PDF parser. Seed SQL creates metadata and
quiz fixtures, not corresponding original files or Markdown objects.

## Dependency audit

`npm audit --omit=dev` still reports a high-severity advisory in the transitive
`effect` dependency through Prisma configuration tooling. npm's proposed forced
fix downgrades Prisma to version 6, so it has not been applied. This must be
resolved before claiming the production dependency set is vulnerability-free.
