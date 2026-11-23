# Backend database integration

Run all commands from the repository's `Backend/` folder.

The schema is documented in [Database design](DATABASE.md):
data dictionary, logical schema, integrity rules, migrations, test data and roles. It has
eleven relational tables plus the read-only `v_user_quiz_progress` view. There is no
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
| `question_options` | Ordered choices; correctness cardinality depends on question type |
| `quiz_attempts` | Submitted attempts; grade is a generated column |
| `quiz_attempt_answers` | Per-question answers for an attempt |
| `quiz_attempt_answer_selections` | Normalized selected options, including multiple selections |

`v_user_quiz_progress` aggregates attempts per user and quiz (completed attempts,
average/best/latest score, workspace, last completion).

Behaviour enforced by PostgreSQL rather than Prisma:

- `score_percent` is `GENERATED ALWAYS AS (...) STORED` and rejects direct writes.
- `updated_at` is set by triggers on `users`, `workspaces`, `materials`,
  `study_guides` and `quizzes`; it is deliberately not Prisma `@updatedAt`.
- CHECK constraints cover non-blank text, allowed MIME types, 1 B–10 MiB sizes,
  `READY` requiring extracted text, job lifecycle timestamps, positive positions
  and attempt counters.
- Partial indexes keep one active extraction and one active quiz-generation job
  per material. Deferred triggers enforce option and selection cardinality for
  single-choice, dropdown and multi-select questions.
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

### Roles and test data

The schema migration creates 10 tables and the progress view; a second migration creates
the `app_read`, `app_write` and `admin` roles and grants least-privilege access. The
NestJS runtime connects as a login that inherits `app_write`, never as `postgres`.

Load the deterministic fixtures (all statuses, size boundaries, multiple attempts) with:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/seed.sql
```

See [Database design](DATABASE.md) for the full data
dictionary, role setup and test-data inventory.

### Case-insensitive e-mail

`schema.prisma` cannot express the functional unique index on `lower(email)`, so
`User.email` is not declared `@unique`. Authentication code must look users up
case-insensitively, for example:

```ts
prisma.user.findFirst({ where: { email: { equals: input, mode: 'insensitive' } } });
```

A duplicate address in any casing still fails with Prisma `P2002`.

