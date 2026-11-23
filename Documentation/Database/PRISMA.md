# Prisma schema and migrations

`schema.prisma` is the data model. `migrations/` contains reviewed SQL that is the
authoritative source of PostgreSQL-specific behaviour (constraints, partial
indexes, generated columns, triggers and the progress view).

## Workflow

```bash
npm run prisma:migrate          # prisma migrate deploy
npm run prisma:migrate:status   # prisma migrate status
npm run prisma:generate         # regenerate the client into src/generated/prisma
```

To change the schema, edit `schema.prisma`, then create a migration with
`prisma migrate diff` / a hand-written SQL file under `migrations/`. Do not run
`prisma migrate dev` against populated data: it reports expected drift because
Prisma cannot represent the generated `score_percent` column, and it may offer to
reset the database.

## Model notes

- **11 tables**: `users`, `workspaces`, `materials`, `processing_jobs`,
  `study_guides`, `quizzes`, `quiz_questions`, `question_options`,
  `quiz_attempts`, `quiz_attempt_answers`, `quiz_attempt_answer_selections`.
- **`v_user_quiz_progress`** is a read-only view. Query it with raw SQL through
  Prisma (`$queryRaw`) or from reporting code; it has no Prisma model.
- **`materials.processing_status`** tracks extraction only. AI generation
  failures must not move a `READY` material out of `READY`; they are recorded on
  `processing_jobs`.
- **`study_guides.storage_key` / `materials.storage_key` /
  `materials.extracted_text_key`** point at private R2 objects. The database
  never stores file bytes or Markdown bodies.
- **`quiz_attempts.score_percent`** is generated in PostgreSQL. It is modelled as
  `Decimal @default(dbgenerated("0"))` only so Prisma can read it; inserts and
  updates that supply a value are rejected by the database.
- **`updated_at`** is owned by a trigger; there is no `@updatedAt`. Only the
  database advances it.
- **`quiz_attempt_answers`** has a composite primary key
  `(attempt_id, question_id)` and composite foreign keys that keep an answer's
  question, option and attempt inside the same quiz.
- **E-mail uniqueness** is a functional unique index on `lower(email)`. Look up
  users case-insensitively; there is no plain `@unique` on `User.email`.

## Reporting

```sql
SELECT *
FROM v_user_quiz_progress
WHERE user_id = $1
ORDER BY last_completed_at DESC;
```

`average_score_percent` is `NUMERIC` (from `AVG(numeric)`), while
`best_score_percent` and `latest_score_percent` are `NUMERIC(5,2)`.

## Roles, seed data and documentation

- `migrations/20261115120000_roles_and_privileges/` creates the `app_read`,
  `app_write` and `admin` roles, grants least-privilege access, sets default
  privileges for future objects and enables `pgcrypto`.
- `seed.sql` loads deterministic fixtures with fixed UUIDs; it is idempotent and
  runs in one transaction:
  `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/seed.sql`.
- The data dictionary, logical schema, integrity rules, transaction patterns and
  access-control setup are in
  [Database design](DATABASE.md).
