# Backend — NestJS API

NestJS 12 REST API with Prisma 7 and PostgreSQL, part of the AI Study Workspace monorepo.

## Structure

```
src/
├── app.module.ts     # root module (ConfigModule + PrismaModule)
├── app.controller.ts
├── app.service.ts
├── main.ts           # bootstrap
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
└── generated/prisma/ # Prisma Client output (git-ignored)
prisma/
├── schema.prisma     # data model (10 tables, 3 enums)
└── migrations/       # hand-reviewed SQL migrations
prisma7.config.ts     # Prisma CLI config (schema, migrations, datasource)
```

## Setup

From this folder:

```bash
npm install
cp .env.example .env        # then set DATABASE_URL
docker compose up -d db     # optional: local PostgreSQL
```

## Commands

Run from this folder:

| Command | Description |
| --- | --- |
| `npm run start:dev` | Watch mode on http://localhost:3000 |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run the compiled app |
| `npm run lint` | oxlint (type-aware) |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Vitest e2e tests |
| `npm run prisma:generate` | Regenerate the Prisma client |
| `npm run prisma:migrate` | Apply pending migrations (`prisma migrate deploy`) |
| `npm run prisma:migrate:status` | Show applied/pending migration status |
| `npm run prisma:studio` | Open Prisma Studio |

## Database

The schema implements the database contract in `AGENT_IMPLEMENTATION_V2.md`: exactly
ten relational tables plus the read-only `v_user_quiz_progress` view. There is no
`material_contents` table — generated Markdown lives in private R2 storage and the
database stores only object keys and metadata.

| Table | Purpose |
| --- | --- |
| `users` | Accounts; `email` is unique case-insensitively |
| `workspaces` | A user's material collection |
| `materials` | Uploaded PDF/DOCX metadata and extraction status |
| `processing_jobs` | PostgreSQL-persisted queue (no Redis/BullMQ) |
| `study_guides` | Generated study-guide objects (R2 key only) |
| `quizzes` | Generated quiz metadata |
| `quiz_questions` | Ordered prompts; immutable once written |
| `question_options` | Ordered choices; at most one correct per question |
| `quiz_attempts` | Submitted attempts; grade is a generated column |
| `quiz_attempt_answers` | Per-question answers for an attempt |

`v_user_quiz_progress` aggregates attempts per user and quiz (completed attempts,
average/best/latest score, workspace, last completion).

Behaviour enforced by PostgreSQL rather than Prisma:

- `score_percent` is `GENERATED ALWAYS AS (...) STORED` and rejects direct writes.
- `updated_at` is set by triggers on `users`, `workspaces`, `materials`,
  `study_guides` and `quizzes`; it is deliberately not Prisma `@updatedAt`.
- CHECK constraints cover non-blank text, allowed MIME types, 1 B–10 MiB sizes,
  `READY` requiring extracted text, job lifecycle timestamps, positive positions
  and attempt counters.
- Partial indexes keep one active extraction job per material and one correct
  option per question, and index queued jobs for claiming.
- `quiz_questions`, `question_options`, `quiz_attempts` and
  `quiz_attempt_answers` reject `UPDATE`.
- Deleting a quiz, material, workspace or user with attempt history is restricted;
  deleting an attempt cascades its answers.

### Migrations

Migrations are committed as reviewed SQL. Apply them with:

```bash
npm run prisma:migrate
```

`prisma migrate dev` reports expected drift for `score_percent` because Prisma
cannot model generated columns; use `prisma migrate deploy` (or `prisma migrate
diff`) and author new migrations deliberately instead. Always run
`npm run prisma:generate` after changing `schema.prisma`.

### Case-insensitive e-mail

`schema.prisma` cannot express the functional unique index on `lower(email)`, so
`User.email` is not declared `@unique`. Authentication code must look users up
case-insensitively, for example:

```ts
prisma.user.findFirst({ where: { email: { equals: input, mode: 'insensitive' } } });
```

A duplicate address in any casing still fails with Prisma `P2002`.

## Environment

See `.env.example`:

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `PORT` | no | HTTP port (default `3000`) |

Configuration is loaded by `@nestjs/config` from `.env` in this folder. The Prisma client uses the `@prisma/adapter-pg` driver adapter and is injected through the global `PrismaModule`.
