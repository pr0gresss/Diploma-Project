# Coding Agent Task: Implement the AI Study Workspace Data Layer and Document Processing

## Mission
Implement the agreed bachelor-diploma MVP data layer and end-to-end document processing in the existing repository. **Do not start by rewriting the application**. Inspect the repository and its existing architecture, dependencies, migrations, tests, and configuration before making changes. Implement in small, testable increments; run the available validation commands after each increment.

**Architecture:** Angular SPA → NestJS REST API (modular monolith) → PostgreSQL and private Cloudflare R2. NestJS also calls Apache Tika over HTTP for text extraction and an external AI provider for study-guide and quiz generation. PostgreSQL and R2 never communicate directly.

**Sources of truth:** This handoff's `schema-proposed.sql` (current proposed schema) and `database-erd.mmd` / `extraction-flow.mmd`, plus the existing repository. If repository code conflicts with the proposed schema, identify and document the discrepancy before migration. Do not claim the SQL is tested until it has been executed against PostgreSQL.

## Scope and invariants

- PostgreSQL has **10 domain tables**: `users`, `workspaces`, `materials`, `processing_jobs`, `study_guides`, `quizzes`, `quiz_questions`, `question_options`, `quiz_attempts`, `quiz_attempt_answers`, plus read-only `v_user_quiz_progress`.
- **No `material_contents` table and no `extracted_text` column.** Cloudflare R2 stores original PDF/DOCX files, Apache Tika-generated `.txt` files, and AI-generated `.md` guides. PostgreSQL stores immutable R2 keys, metadata, relationships, job statuses, quizzes, and attempts.
- All R2 buckets are private. Do not expose R2 access keys or use public object URLs for protected content.
- Use `materials.original_filename` for the original upload name and `materials.display_name` for the editable user-visible name. Renaming changes only PostgreSQL; never copy/rename an R2 object. Use UUID-based object keys such as `materials/<id>/original.pdf`, `materials/<id>/extracted.txt`, `study-guides/<id>/content.md`; do not include personal information/user input in object keys.
- `materials.processing_status` represents **text-extraction readiness only**, with `UPLOADED`, `PROCESSING`, `READY`, `FAILED`. `processing_jobs` records individual `EXTRACT_TEXT`, `GENERATE_GUIDE`, `GENERATE_QUIZ` executions, with `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`. A failed AI job **must not** change an already `READY` material to `FAILED`.
- Only processed `READY` materials with a confirmed `extracted_text_key` can be used for AI generation. Empty or malformed extraction is a failure, not success.
- Single-answer multiple-choice questions only in the MVP. Enforce at least two answer options and exactly one correct option for each question before saving a quiz.
- Do not add vector embeddings, pgvector, Redis/BullMQ, microservices, adaptive learning, audio/video support, per-topic analytics or advanced misconception detection without a demonstrated requirement.
- No production credentials or fabricated AI results in source code or tests.

## Step 0 — Inspect and report briefly

1. Examine repository layout and installed NestJS, Angular, ORM, Docker, CI and testing versions. Preserve existing code and conventions.
2. Determine whether Prisma is already installed. Prefer Prisma for a new data layer; if a different ORM is already implemented, assess migration cost before switching. Use the repository's actual installed Prisma version; do not blindly apply examples from a different major version.
3. Check authentication and workspace authorization implementation before building data services.
4. Identify any existing data/migrations. **Never drop or reset an existing populated database.** Add migrations or an explicit safe migration plan.
5. List any decisions/blockers without stopping other safe implementation work: notably deletion/history retention, real AI provider credentials, and where the Apache Tika service will be deployed for Heroku.

## Step 1 — PostgreSQL schema and migrations

Implement the tables, enum values, constraints, relationships, indexes, `updated_at` management, and `v_user_quiz_progress` according to `schema-proposed.sql`.

- Model tables in Prisma if Prisma is selected and commit repeatable migrations. PostgreSQL-specific triggers, computed score column, view, and any features not expressible in the selected Prisma version need **hand-reviewed SQL in the migration**. Do not rely on `prisma db push` as the production migration strategy.
- Ensure email uniqueness is case-insensitive, material MIME/size are constrained, `storage_key` is unique, `READY` implies `extracted_text_key IS NOT NULL`, question/option ordering is unique within parents, at most one correct option is allowed, and attempt answers cannot reference a different quiz/question or invalid option.
- Preserve the database-generated `score_percent` expression and read-only progress view, or document and test a fully equivalent implementation if the ORM requires an adaptation.
- Add indexes for owner/workspace/material traversal, queued jobs, and attempts ordered by submission date. Do not index every field indiscriminately.
- For `updated_at`, choose **one consistent mechanism** (existing PostgreSQL triggers or ORM-level automatic updates), never conflicting duplicate mechanisms.
- Test migrations on an empty PostgreSQL database, then test applying them to the current dev schema without losing data. Check rollback/recovery policy.

### Deletion decision (do not silently lose student history)
The proposed SQL uses `ON DELETE CASCADE` for many relationships. Before exposing destructive endpoints, **protect assessments**: do not allow deletion of a quiz/material/workspace containing completed attempts until retention semantics are approved. A safe MVP behavior is HTTP 409 with an explanatory message; do not silently wipe history. Deletion of a resource without attempts may proceed, but its R2 objects still require cleanup. Note this temporary policy in README/API docs. If a deletion/retention policy already exists in the repository, respect and test it.

## Step 2 — Storage and Tika infrastructure

- Implement a NestJS `StorageService` interface with `putObject`, `getObject` (with bounded streaming/buffer behavior), `deleteObject`, and optional `objectExists`. Provide a Cloudflare R2 adapter using `@aws-sdk/client-s3`, custom R2 endpoint, region `auto`, bucket, access key, secret, and reasonable request timeouts. Make it mockable.
- Required environment variables: `DATABASE_URL`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `TIKA_URL`; add AI provider config only if an AI adapter is implemented. Provide `.env.example`, never commit secrets.
- Add Docker Compose for development as appropriate: PostgreSQL, Apache Tika Server, NestJS API (and Angular if already containerized). Pin an explicit tested Tika image version. Ensure NestJS reaches Tika through container network DNS, not `localhost` inside a container. Use health checks where practical.
- Implement `DocumentExtractionService` that sends original binary to the Tika HTTP endpoint using `PUT` and a proper content type. For the pinned Tika version, verify that the chosen endpoint returns **plain text** (typically `/tika/text`); do not submit multipart data to a PUT endpoint expecting raw bytes.
- Guard against SSRF: `TIKA_URL` must be a trusted administrator configuration, never user-supplied. Configure request timeout, size limits and failure messages that do not reveal secrets. OCR for image-only scans is **out of scope**; report an actionable unsupported/empty-text error.

## Step 3 — Upload and extraction job lifecycle

Build this exact workflow with robust partial-failure handling:

1. Authenticate request and verify the caller owns the target workspace.
2. Validate PDF/DOCX extension, actual file signature/type and max **10 MiB**, reject malformed or zero-length uploads. Do not trust browser MIME only. Apply request body limits.
3. Generate material UUID and stable R2 key, upload original bytes to **private** R2; create `materials` and `processing_jobs(EXTRACT_TEXT, QUEUED)` records. If one step fails, compensate for an orphaned R2 object or mark an incomplete operation so it can be reconciled. Respond with `202 Accepted` + material ID and processing status.
4. Claim queued jobs safely, update `processing_jobs.status=RUNNING` and `materials.processing_status=PROCESSING` for extraction only. Make claims concurrency safe (e.g., PostgreSQL `FOR UPDATE SKIP LOCKED` or an equivalent tested mechanism) and recover jobs after a worker crash/restart. **Avoid in-memory-only fire-and-forget processing that disappears on restart.** A database-backed worker loop is sufficient for the MVP; do not add Redis without need.
5. Download the original from R2, send it to Tika, validate non-empty UTF-8 text and enforce configurable extraction output/provider input limits. Do not silently truncate material while pretending to process all of it.
6. Store extracted text in R2 at a `.txt` key with `text/plain; charset=utf-8`.
7. After R2 confirms success, in one **short PostgreSQL transaction** update `materials.extracted_text_key`, set `processing_status=READY`, and mark the corresponding job `SUCCEEDED` and `finished_at`. **Never wrap an external R2/Tika/AI call inside a database transaction.**
8. On failure, set material extraction status `FAILED`, job `FAILED` and a sanitized error message, retaining the original document so the user can retry. If step 7 fails after `.txt` was uploaded, clean the orphaned object or reconcile it later.
9. Retry endpoint creates a **new** extraction job while preventing duplicate active extraction jobs; avoid races and ensure existing READY content is not lost without an explicit reprocess workflow.

## Step 4 — AI generated resources

- Define an `AiGenerationProvider` interface for structured guide/quiz generation and use a mock provider in tests. If a real provider is already configured, implement a concrete adapter without coupling business rules to the SDK.
- `POST /materials/:id/study-guides`: authorize access; require `READY`; create `GENERATE_GUIDE` job; download `.txt` from R2; generate validated Markdown; write UTF-8 `.md` to private R2; then create `study_guides` metadata and finish the job. Preserve incomplete/error state and clean orphaned objects on failure.
- `GET /study-guides/:id` and `GET /study-guides/:id/content` must authorize ownership and return metadata/content safely. Render Markdown in Angular through a sanitizer that prevents dangerous HTML/scripts. Support `PATCH /study-guides/:id` updating **display name only**.
- `POST /materials/:id/quizzes`: authorize; require `READY`; queue `GENERATE_QUIZ` job; retrieve `.txt`; validate the provider's structured output strictly; create quiz/questions/options **atomically** (all-or-nothing); mark job success/failure accordingly. Store quizzes in PostgreSQL, **not** R2.
- `PATCH /materials/:id` updates `display_name`, not object keys or original name; `PATCH /quizzes/:id` updates its `display_name` only. Do not allow editing quiz questions after attempts exist.
- No invalid, empty or partially generated resource may appear as successfully created.

## Step 5 — Assessment and progress

- Provide authenticated quiz read endpoint that **does not disclose correct answers or grading flags before submission**. Use separate DTOs for taking a quiz and viewing results.
- `POST /quizzes/:id/attempts`: validate the student's ownership, quiz availability, exactly one selected option per question (or implement an explicit documented unanswered-answer policy), and the option/question/quiz membership. Derive correctness and `correct_answers` **on the server**, never trust client scores or `is_correct` values.
- Save one attempt and all its answers in one PostgreSQL transaction. Enforce the composite foreign keys in `schema-proposed.sql`.
- Expose `GET /me/attempts`, `GET /attempts/:id`, and `GET /me/progress` (via `v_user_quiz_progress` or equivalent query). Filter by authenticated user; never trust a client-supplied `user_id`.
- If an existing repository supports multiple question types, limit changes to the documented single-choice MVP and avoid regressions.

## Step 6 — REST surface and module boundaries

Follow existing URL conventions; if none exist, aim for:

| Endpoint | Behavior |
|---|---|
| `POST /auth/register`, `POST /auth/login` | Account creation/login (if not already implemented) |
| `GET/POST /workspaces`, `PATCH/DELETE /workspaces/:id` | Owned workspace CRUD |
| `POST /workspaces/:id/materials` | Upload document, respond with queued status |
| `GET /workspaces/:id/materials`, `GET /materials/:id` | List/get authorized document metadata |
| `PATCH /materials/:id` | Edit `display_name` only |
| `GET /materials/:id/file` | Authorized download of original via API or short-lived signed URL |
| `POST /materials/:id/retry-extraction` | Requeue a failed extraction |
| `GET /materials/:id/jobs` | Authorized job/status history |
| `POST /materials/:id/study-guides` | Queue guide generation |
| `GET /study-guides/:id/content`, `PATCH /study-guides/:id` | Read Markdown / rename |
| `POST /materials/:id/quizzes`, `GET /quizzes/:id`, `PATCH /quizzes/:id` | Generate/read/rename quiz |
| `POST /quizzes/:id/attempts` | Grade and store one quiz attempt |
| `GET /me/attempts`, `GET /attempts/:id`, `GET /me/progress` | Assessment history and progress |

Use NestJS modules/services for Auth, Workspaces, Materials, DocumentProcessing, Storage, StudyGuides, Quizzes, Assessments, LearningProgress, AI; a modular monolith, not microservices. Add NestJS DTO validation, guards, consistent error responses, Swagger/OpenAPI decorators, structured logs without secrets, and minimal Angular integration only where missing.

## Step 7 — Automated verification (required)

Implement tests with real PostgreSQL in CI/integration tests and mocked R2/Tika/AI where appropriate. At minimum cover:

1. Clean migration produces 10 tables + 1 progress view, enum types, indexes and constraints; repeatable migrations.
2. User B cannot list, read, rename, download, retry or delete resources belonging to User A (including guessed UUID paths).
3. File >10 MiB, empty file, wrong signature and unsupported types are rejected.
4. Upload succeeds → status/job transitions `UPLOADED → PROCESSING → READY`, `.txt` object stored in R2, key recorded in PostgreSQL.
5. Tika returns timeout, error or empty output → `FAILED`, no `extracted_text_key`, original remains and retry can succeed.
6. Crash/restart does not permanently lose queued/running jobs; duplicate requests do not execute conflicting active extraction jobs.
7. R2 upload success + DB failure leaves no untracked permanent garbage (cleanup/reconciliation tested).
8. Generation is rejected for non-READY material; failed/invalid AI output is never shown as success. Markdown exists in R2 and quiz records are complete in PostgreSQL.
9. Renaming updates only `display_name`; R2 key and original file name remain unchanged.
10. Quiz-taking endpoint hides correct options. Cross-quiz option injection is rejected, and server grading is correct.
11. Attempt and answer persistence is atomic; progress view latest/best/average values are correct.
12. Destructive deletion cannot silently erase completed assessment history; deleting eligible resources cleans R2 objects.
13. Lint, typecheck, unit tests, integration tests, Docker Compose smoke test, Swagger generation and CI pipeline complete successfully.

## Delivery format and acceptance criteria

Implement the code, not just architecture advice. Work milestone by milestone and commit coherent migrations/tests/code when Git is available. Before ending, report:

- Files changed, modules and endpoints implemented, and commands to start locally.
- Migration command(s), `docker compose` startup sequence and sample `.env.example` (without secrets).
- Evidence from executed tests and commands, with pass/fail counts; don't claim verification for anything not run.
- Remaining blockers and explicit product decisions, especially Tika production deployment and assessment-retention behavior.
- Any intentional differences from `schema-proposed.sql` with rationale.

**Definition of done:** An authenticated student can upload a valid PDF/DOCX to an owned workspace, observe extraction status, retry a failed extraction, generate a Markdown guide in private R2 and a relational quiz from R2-extracted text, complete that quiz with server-validated grading, and view persisted assessment history and progress. All data remains accessible after restarting the NestJS container, and users cannot access each other's resources.
