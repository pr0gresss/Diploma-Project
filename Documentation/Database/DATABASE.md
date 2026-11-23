# Database Documentation — AI Study Workspace

Database design, data dictionary, integrity rules, deployment, test data, and access
control for the AI Study Workspace diploma project.

## Current schema revision: typed quizzes (23 November 2026)

Migration [`20261123120000_question_types_and_selections`](../../Backend/prisma/migrations/20261123120000_question_types_and_selections/migration.sql)
extends the original schema documented in Sections 1–15 below. Where those
baseline sections describe single-answer-only quizzes, this revision supersedes
them. The current schema has **11 tables and 4 enums**.

- `quiz_questions.question_type` uses `quiz_question_type`:
  `SINGLE_CHOICE`, `SELECT`, `MULTI_SELECT`. Existing questions default to
  `SINGLE_CHOICE`, without changing their content or timestamps.
- `quiz_attempt_answer_selections` is the authoritative normalized selection
  table. Its composite primary key is
  `(attempt_id, question_id, selected_option_id)`. Composite foreign keys bind
  each selection to its per-question answer and an option of the same question.
- Existing answer selections are backfilled. The old parent
  `quiz_attempt_answers.selected_option_id` remains as a first-option compatibility
  mirror, **not the complete answer for multi-select**.
- Deferred constraint triggers replace the old one-correct-option unique index:
  radio/dropdown questions require exactly one correct option; multi-select
  questions require one or more. All questions require 2–10 options.
- Deferred selection checks enforce a nonempty distinct set, exactly one for
  radio/dropdown questions, a valid compatibility mirror, and exact-set answer
  correctness. Grading awards one point per completely correct question, with
  no partial credit. The generated percentage column remains unchanged.
- Selection rows reject updates and have explicit least-privilege grants.
- A partial unique index allows at most one queued/running `GENERATE_QUIZ` job
  per material. Validated generated quizzes and job success are committed
  together; provider calls stay outside transactions.

The applied local migration preserved 3 quizzes, 4 attempts and 11 answers and
backfilled 11 selection rows. The checksum of stored grades was unchanged.
This describes the verification dataset, not a fixed production row count.

For the API/OAuth flow and compatibility fields, see
[`OPENAI_OAUTH.md`](../Backend/AI/OPENAI_OAUTH.md).

- **DBMS:** PostgreSQL 17
- **Schema source of truth:** [`Backend/prisma/schema.prisma`](../../Backend/prisma/schema.prisma)
- **DDL:** versioned Prisma SQL migrations in [`Backend/prisma/migrations/`](../../Backend/prisma/migrations) — this document links to them instead of duplicating the DDL
- **Test data:** [`Backend/prisma/seed.sql`](../../Backend/prisma/seed.sql)

---

## 1. Requirement coverage

This document is organised as a direct answer to the transactional database (OLTP)
requirements of the diploma project. Every required item has a concrete artefact.

| Requirement | Where it is satisfied |
| --- | --- |
| **Documentation:** data dictionary with layers, tables, columns, types, keys, data quality | Sections 3–6 and 12 |
| **Documentation:** data integrity and transaction handling | Section 9 |
| **Documentation:** ER diagram (optional) | Section 5 (provided anyway) |
| **Documentation:** clear logical schema with main blocks and relationships | Section 5 (colour-coded block diagram + ER diagram) |
| **Documentation:** DDL script | Replaced by links to the versioned migrations in Section 10, as requested |
| **Design:** modern relational DBMS | PostgreSQL 17 |
| **Design:** normalisation up to 3NF | Section 8 |
| **Design:** enough tables and different relationship types | 10 tables, 1:N, optional 1:N, N:M through an associative table, identifying relationships |
| **Design:** primary and foreign keys on all tables | Section 7 |
| **Design:** NOT NULL, UNIQUE, CHECK and other constraints | Sections 6 and 7 |
| **Design:** meaningful data types | Section 6 (UUID, `timestamptz`, `numeric(5,2)`, `bigint`, enums) |
| **Deployment:** structure created by migrations, not manually | Section 10 |
| **Deployment:** scripts in Git | Section 10 |
| **Test data:** enough records, including edge cases | Section 11 |
| **Test data:** scripts for fixed/reference data | Section 11 (enum types plus seed script) |
| **Usage:** `app_read`, `app_write`, `admin` roles | Section 12 |
| **Usage:** application does not run as superuser | Section 12 |
| **Usage:** permissions checked/updated for new objects | Section 12 |
| **Usage:** passwords stored hashed, no MD5/SHA-1 | Section 12 |
| **Usage:** integrity via constraints and transactions | Section 9 |
| **Restrictions:** no plaintext passwords, no CSV/Excel as sole storage, no unmodelled JSON, no ignored integrity | Section 13 |

---

## 2. Technology stack

| Concern | Choice |
| --- | --- |
| Database | PostgreSQL 17 (`postgres:17-alpine` in `Backend/docker-compose.yml`) |
| Access layer | NestJS 12 with Prisma 7 and `@prisma/adapter-pg` |
| Migrations | Prisma Migrate, applied with `prisma migrate deploy` |
| Primary keys | UUID v4 generated by PostgreSQL (`gen_random_uuid()`) |
| Timestamps | `timestamptz(6)`, stored in UTC |
| Derived data | Generated columns and a read-only view |
| Binary/document storage | Private Cloudflare R2; PostgreSQL stores only immutable object keys and metadata |

PostgreSQL is a modern, ACID-compliant relational DBMS. It provides transactional DDL,
foreign keys, `CHECK` constraints, partial and functional indexes, generated columns,
triggers, and a fine-grained privilege system (`GRANT`/`REVOKE`), all of which this
schema uses.

---

## 3. Data layers

The model is split into five logical layers in one physical database. The layers are
defined by responsibility, not by separate schemas or servers.

| Layer | Tables / objects | Responsibility |
| --- | --- | --- |
| **Identity and access** | `users`, `workspaces` | Accounts and the ownership boundary for all student content |
| **Content ingestion** | `materials`, `processing_jobs` | Uploaded PDF/DOCX metadata and the durable extraction/generation queue |
| **Learning resources** | `study_guides`, `quizzes`, `quiz_questions`, `question_options` | AI-generated guides and the relational quiz structure |
| **Assessment** | `quiz_attempts`, `quiz_attempt_answers` | Submitted attempts and per-question grading snapshots |
| **Reporting** | `v_user_quiz_progress` (view) | Aggregated progress per user and quiz |

There is also a **storage split** inside the application:

- **PostgreSQL** owns metadata, relationships, status, quiz structure, grading and
  access-control-relevant identifiers.
- **Private object storage (R2)** owns the original PDF/DOCX bytes, extracted `.txt`
  files and generated Markdown guides. PostgreSQL references them with immutable
  object keys (`materials.storage_key`, `materials.extracted_text_key`,
  `study_guides.storage_key`). No file body, binary blob or Markdown document is
  stored in the database.

There is deliberately **no `material_contents` table**: extracted text is a file, not
a relational entity, and the database stores only its key and processing status.

---

## 4. Domain rules at a glance

- A **user** owns zero or more **workspaces**; a workspace belongs to exactly one user.
- A **workspace** contains zero or more **materials**; a material belongs to exactly
  one workspace.
- A **material** tracks text-extraction readiness only: `UPLOADED → PROCESSING →
  READY`, or `FAILED`. An AI generation failure never moves a `READY` material out of
  `READY`; it is recorded on a **processing job**.
- A **material** can produce multiple **study guides** and multiple **quizzes**.
- A **quiz** has ordered **questions**, and every question has ordered **options**.
  The MVP supports single-answer multiple choice: at least two options and at most one
  correct option per question.
- A user submits **attempts** for a quiz. Each attempt stores one answer per question.
  Correctness and the score are derived by the server/database, never trusted from the
  client.
- Submitted quiz structure and attempts are **immutable**. They are history, not
  editable configuration.
- Deleting a quiz, material, workspace or user that still has attempt history is
  restricted by foreign keys; the API reports a conflict instead of silently deleting
  student history.

---

## 5. Logical schema

### 5.1 Blocks and relationships (colour-coded)

Blue = identity, green = ingestion, amber = learning resources, pink = assessment,
violet = reporting, grey = external storage.

```mermaid
flowchart LR
    subgraph identity["Identity and access"]
        users["users"]
        workspaces["workspaces"]
    end

    subgraph ingestion["Content ingestion"]
        materials["materials"]
        jobs["processing_jobs"]
    end

    subgraph resources["Learning resources"]
        guides["study_guides"]
        quizzes["quizzes"]
        questions["quiz_questions"]
        options["question_options"]
    end

    subgraph assessment["Assessment"]
        attempts["quiz_attempts"]
        answers["quiz_attempt_answers"]
    end

    subgraph reporting["Reporting"]
        progress["v_user_quiz_progress (view)"]
    end

    storage[("Private object storage<br/>R2 files and Markdown")]

    users -->|owns| workspaces
    workspaces -->|contains| materials
    materials -->|tracks| jobs
    materials -->|produces| guides
    materials -->|produces| quizzes
    quizzes -->|has| questions
    questions -->|offers| options
    users -->|submits| attempts
    quizzes -->|receives| attempts
    attempts -->|records| answers
    questions -->|answered by| answers
    options -->|selected in| answers
    materials -.->|storage keys| storage
    guides -.->|storage key| storage
    attempts -.->|aggregated into| progress

    classDef identity fill:#dbeafe,stroke:#2563eb,color:#1e3a8a,stroke-width:2px
    classDef ingestion fill:#dcfce7,stroke:#16a34a,color:#14532d,stroke-width:2px
    classDef resources fill:#fef3c7,stroke:#d97706,color:#78350f,stroke-width:2px
    classDef assessment fill:#fce7f3,stroke:#db2777,color:#831843,stroke-width:2px
    classDef reporting fill:#ede9fe,stroke:#7c3aed,color:#4c1d95,stroke-width:2px
    classDef external fill:#f1f5f9,stroke:#64748b,color:#334155,stroke-width:2px,stroke-dasharray: 5 5

    class users,workspaces identity
    class materials,jobs ingestion
    class guides,quizzes,questions,options resources
    class attempts,answers assessment
    class progress reporting
    class storage external
```

### 5.2 ER diagram

`PK` = primary key, `FK` = foreign key, `UK` = uniquely indexed. Composite keys are
marked on each participating column. `users.email` is unique through a functional
index on `lower(email)`, so addresses that differ only in case are rejected at the
database level; the diagram shows it as a plain `UK` for readability.

```mermaid
erDiagram
    users {
        uuid id PK
        varchar email UK
        text password_hash
        timestamptz created_at
        timestamptz updated_at
    }

    workspaces {
        uuid id PK
        uuid owner_user_id FK
        varchar name
        timestamptz created_at
        timestamptz updated_at
    }

    materials {
        uuid id PK
        uuid workspace_id FK
        varchar original_filename
        varchar display_name
        varchar mime_type
        bigint size_bytes
        text storage_key UK
        text extracted_text_key UK
        enum processing_status
        timestamptz created_at
        timestamptz updated_at
    }

    processing_jobs {
        uuid id PK
        uuid material_id FK
        enum job_type
        enum status
        text error_message
        timestamptz created_at
        timestamptz started_at
        timestamptz finished_at
    }

    study_guides {
        uuid id PK
        uuid material_id FK
        varchar display_name
        text storage_key UK
        timestamptz created_at
        timestamptz updated_at
    }

    quizzes {
        uuid id PK
        uuid material_id FK
        varchar display_name
        timestamptz created_at
        timestamptz updated_at
    }

    quiz_questions {
        uuid id PK
        uuid quiz_id FK
        integer position
        text prompt
        text explanation
    }

    question_options {
        uuid id PK
        uuid question_id FK
        integer position
        text option_text
        boolean is_correct
    }

    quiz_attempts {
        uuid id PK
        uuid quiz_id FK
        uuid user_id FK
        timestamptz submitted_at
        integer total_questions
        integer correct_answers
        numeric score_percent
    }

    quiz_attempt_answers {
        uuid attempt_id PK
        uuid quiz_id FK
        uuid question_id PK
        uuid selected_option_id FK
        boolean is_correct
    }

    users ||--o{ workspaces : owns
    users ||--o{ quiz_attempts : submits
    workspaces ||--o{ materials : contains
    materials ||--o{ processing_jobs : records
    materials ||--o{ study_guides : generates
    materials ||--o{ quizzes : generates
    quizzes ||--o{ quiz_questions : contains
    quiz_questions ||--o{ question_options : offers
    quizzes ||--o{ quiz_attempts : receives
    quiz_attempts ||--o{ quiz_attempt_answers : stores
    quiz_questions ||--o{ quiz_attempt_answers : answered_by
    question_options ||--o{ quiz_attempt_answers : selected_as
```

`v_user_quiz_progress` is a read-only aggregate over `quiz_attempts`, `quizzes` and
`materials`; it is not an entity and therefore is not drawn as a table.

### 5.3 Relationship types

| Relationship | Type | Implementation |
| --- | --- | --- |
| `users` → `workspaces` | 1:N | `workspaces.owner_user_id` |
| `workspaces` → `materials` | 1:N | `materials.workspace_id` |
| `materials` → `processing_jobs` | 1:N | `processing_jobs.material_id` |
| `materials` → `study_guides` | optional 1:N | `study_guides.material_id` |
| `materials` → `quizzes` | optional 1:N | `quizzes.material_id` |
| `quizzes` → `quiz_questions` | 1:N | `quiz_questions.quiz_id` |
| `quiz_questions` → `question_options` | 1:N | `question_options.question_id` |
| `quizzes` → `quiz_attempts` | 1:N | `quiz_attempts.quiz_id` |
| `users` → `quiz_attempts` | 1:N | `quiz_attempts.user_id` |
| `quiz_attempts` ↔ `quiz_questions` | N:M through `quiz_attempt_answers` | Composite PK `(attempt_id, question_id)` |
| `quiz_attempt_answers` → `question_options` | N:1 | `selected_option_id` inside the same question |

---

## 6. Data dictionary

### 6.1 Conventions

- Names are `snake_case` in PostgreSQL and mapped from `camelCase` in Prisma.
- Every table has a surrogate UUID primary key, except the associative
  `quiz_attempt_answers`, which uses a natural composite key.
- `created_at` is the insertion time; `updated_at` is maintained by a PostgreSQL
  trigger on mutable tables. `timestamptz(6)` avoids timezone ambiguity and keeps
  microsecond precision.
- Text columns that must contain visible content have `CHECK (btrim(col) <> '')`
  constraints.
- Binary sizes are `bigint` bytes; percentages are `numeric`, never floating point.
- Enumerated values are PostgreSQL enum types, not free-form strings.
- Object keys are opaque, immutable strings. Renaming a user-visible name never
  changes a key.

### 6.2 Enum types (fixed reference data)

Enum types are the project's reference data: they are versioned in the initial
migration, so no separate lookup tables or CSV imports are needed.

| Enum type | Values | Meaning |
| --- | --- | --- |
| `material_processing_status` | `UPLOADED`, `PROCESSING`, `READY`, `FAILED` | Text-extraction readiness of a material |
| `processing_job_type` | `EXTRACT_TEXT`, `GENERATE_GUIDE`, `GENERATE_QUIZ` | Kind of background work |
| `processing_job_status` | `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED` | Lifecycle of one job |

### 6.3 `users`

Account records. One row per student.

| Column | Type | Null | Default | Key / constraint | Description |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK | Surrogate identifier |
| `email` | `varchar(320)` | no | — | Unique on `lower(email)`; non-blank | Login address, case-insensitively unique |
| `password_hash` | `text` | no | — | Non-blank | One-way salted password hash (see Section 12) |
| `created_at` | `timestamptz(6)` | no | `CURRENT_TIMESTAMP` | — | Registration time |
| `updated_at` | `timestamptz(6)` | no | `CURRENT_TIMESTAMP` | Trigger `users_set_updated_at` | Last profile change |

**Constraints and indexes**

- `users_pkey` on `id`.
- `users_email_lower_key` — functional unique index on `lower(email)`; this is the
  single e-mail uniqueness policy (no plain `UNIQUE` index is duplicated).
- `users_email_nonblank_check`, `users_password_hash_nonblank_check`.

**Data quality expectations**

- E-mail is trimmed by the application, max 320 characters, and compared
  case-insensitively.
- `password_hash` is never plaintext, never a fast unsalted digest (MD5/SHA-1), and
  never returned by the API.
- A user row is created only together with a valid hash; invalid formats are rejected
  before `INSERT`.
- Deleting a user is restricted while attempts exist (`quiz_attempts.user_id`).

### 6.4 `workspaces`

A named container of materials owned by one user.

| Column | Type | Null | Default | Key / constraint | Description |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK | Surrogate identifier |
| `owner_user_id` | `uuid` | no | — | FK → `users.id`, `ON DELETE CASCADE` | Owning student |
| `name` | `varchar(120)` | no | — | Non-blank | User-visible workspace name |
| `created_at` | `timestamptz(6)` | no | `CURRENT_TIMESTAMP` | — | Creation time |
| `updated_at` | `timestamptz(6)` | no | `CURRENT_TIMESTAMP` | Trigger `workspaces_set_updated_at` | Last rename |

**Constraints and indexes**

- `workspaces_pkey` on `id`.
- `workspaces_owner_user_id_fkey` → `users.id`.
- `workspaces_name_nonblank_check`.
- `workspaces_owner_user_id_created_at_idx` on `(owner_user_id, created_at DESC)` for
  listing a user's workspaces newest first.

**Data quality expectations**

- Every workspace has an existing owner; orphan workspaces are impossible.
- Names are non-blank and limited to 120 characters.
- A user may have zero workspaces (valid empty state).
- No cross-user access is representable at the database level; the API must always
  filter by `owner_user_id` and must never trust a client-supplied owner.

### 6.5 `materials`

Metadata for one uploaded PDF/DOCX file. File bodies live in private object storage.

| Column | Type | Null | Default | Key / constraint | Description |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK | Material identifier, also used in object keys |
| `workspace_id` | `uuid` | no | — | FK → `workspaces.id`, `ON DELETE CASCADE` | Parent workspace |
| `original_filename` | `varchar(255)` | no | — | Non-blank | Name as uploaded; immutable |
| `display_name` | `varchar(255)` | no | — | Non-blank | Editable user-visible name |
| `mime_type` | `varchar(100)` | no | — | `CHECK` in (`application/pdf`, DOCX MIME) | Validated document type |
| `size_bytes` | `bigint` | no | — | `CHECK` 1 … 10,485,760 | Exact upload size in bytes |
| `storage_key` | `text` | no | — | `UNIQUE`, non-blank | Immutable private object key for the original |
| `extracted_text_key` | `text` | yes | `NULL` | `UNIQUE`, null-or-non-blank | Object key for Tika-extracted `.txt`; set only on success |
| `processing_status` | `material_processing_status` | no | `'UPLOADED'` | Enum; `READY` requires `extracted_text_key` | Extraction readiness |
| `created_at` | `timestamptz(6)` | no | `CURRENT_TIMESTAMP` | — | Upload time |
| `updated_at` | `timestamptz(6)` | no | `CURRENT_TIMESTAMP` | Trigger `materials_set_updated_at` | Last metadata/status change |

**Constraints and indexes**

- `materials_pkey` on `id`.
- `materials_workspace_id_fkey` → `workspaces.id`.
- `materials_storage_key_key`, `materials_extracted_text_key_key` — unique keys; a
  storage object can belong to at most one material.
- `materials_workspace_id_created_at_idx` on `(workspace_id, created_at DESC)`.
- `materials_original_filename_nonblank_check`,
  `materials_display_name_nonblank_check`,
  `materials_storage_key_nonblank_check`,
  `materials_extracted_text_key_nonblank_check`.
- `materials_mime_type_check` — only PDF and DOCX are accepted.
- `materials_size_bytes_check` — at least 1 byte and at most 10 MiB.
- `materials_ready_requires_extracted_text_check` — a `READY` material always has an
  extracted-text key.

**Data quality expectations**

- File type is verified by content/signature in the application, not only by browser
  MIME; the database enforces the same allow-list.
- Zero-length files and files over 10 MiB are rejected by the database as well as the
  API.
- `original_filename` and `storage_key` never change after insert; renames touch only
  `display_name`.
- Keys are opaque UUID-based paths and contain no personal data or user input.
- `processing_status` describes extraction only. AI generation outcomes belong to
  `processing_jobs` and must not change a `READY` material.
- A failed extraction keeps the original key so retry is possible, and leaves
  `extracted_text_key` `NULL`.

### 6.6 `processing_jobs`

Durable, database-backed queue for extraction and AI generation. No Redis/BullMQ.

| Column | Type | Null | Default | Key / constraint | Description |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK | Job identifier |
| `material_id` | `uuid` | no | — | FK → `materials.id`, `ON DELETE CASCADE` | Material being processed |
| `job_type` | `processing_job_type` | no | — | Enum | `EXTRACT_TEXT`, `GENERATE_GUIDE`, `GENERATE_QUIZ` |
| `status` | `processing_job_status` | no | `'QUEUED'` | Enum | Job lifecycle state |
| `error_message` | `text` | yes | `NULL` | — | Sanitized failure reason; no secrets |
| `created_at` | `timestamptz(6)` | no | `CURRENT_TIMESTAMP` | — | Enqueue time |
| `started_at` | `timestamptz(6)` | yes | `NULL` | Required when `RUNNING` | Claim time |
| `finished_at` | `timestamptz(6)` | yes | `NULL` | Required when terminal; ≥ `started_at` | Completion time |

**Constraints and indexes**

- `processing_jobs_pkey` on `id`.
- `processing_jobs_material_id_fkey` → `materials.id`.
- `processing_jobs_material_id_created_at_idx` on `(material_id, created_at DESC)`.
- `processing_jobs_queued_idx` — partial index on `created_at DESC WHERE status = 'QUEUED'`
  for efficient claiming.
- `processing_jobs_active_extraction_key` — partial unique index on `material_id`
  `WHERE job_type = 'EXTRACT_TEXT' AND status IN ('QUEUED', 'RUNNING')`; at most one
  active extraction per material.
- `processing_jobs_running_requires_started_at_check`.
- `processing_jobs_terminal_requires_finished_at_check`.
- `processing_jobs_finished_after_started_check`.

**Data quality expectations**

- A job in `RUNNING` always has `started_at`; `SUCCEEDED`/`FAILED` always have
  `finished_at`; completion never precedes start.
- Error messages are sanitized and never contain credentials or full provider payloads.
- Duplicate active extraction requests cannot create a second queued/running
  extraction job.
- Status and timing columns are updated in place as a job progresses; rows are not
  rewritten or replaced, and they are removed only by the cascade when their material
  is deleted. Retention follows the material, so job history stays available for audit
  for as long as the material exists.
- A failed AI job does not alter `materials.processing_status`.

### 6.7 `study_guides`

Metadata for an AI-generated Markdown study guide. The Markdown body is in R2.

| Column | Type | Null | Default | Key / constraint | Description |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK | Guide identifier |
| `material_id` | `uuid` | no | — | FK → `materials.id`, `ON DELETE CASCADE` | Source material |
| `display_name` | `varchar(255)` | no | — | Non-blank | Editable user-visible name |
| `storage_key` | `text` | no | — | `UNIQUE`, non-blank | Private `.md` object key |
| `created_at` | `timestamptz(6)` | no | `CURRENT_TIMESTAMP` | — | Creation time |
| `updated_at` | `timestamptz(6)` | no | `CURRENT_TIMESTAMP` | Trigger `study_guides_set_updated_at` | Last rename |

**Constraints and indexes**

- `study_guides_pkey` on `id`.
- `study_guides_material_id_fkey` → `materials.id`.
- `study_guides_storage_key_key` unique.
- `study_guides_material_id_created_at_idx` on `(material_id, created_at DESC)`.
- `study_guides_display_name_nonblank_check`,
  `study_guides_storage_key_nonblank_check`.

**Data quality expectations**

- A guide row is written only after its Markdown object has been stored successfully.
- `storage_key` is immutable and unique; renaming changes only `display_name`.
- Markdown is rendered through a sanitizer in the frontend; the database does not store
  HTML.
- If the object upload fails, no guide row is committed.

### 6.8 `quizzes`

Metadata for one generated single-answer multiple-choice quiz.

| Column | Type | Null | Default | Key / constraint | Description |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK | Quiz identifier |
| `material_id` | `uuid` | no | — | FK → `materials.id`, `ON DELETE CASCADE` | Source material |
| `display_name` | `varchar(255)` | no | — | Non-blank | Editable user-visible name |
| `created_at` | `timestamptz(6)` | no | `CURRENT_TIMESTAMP` | — | Creation time |
| `updated_at` | `timestamptz(6)` | no | `CURRENT_TIMESTAMP` | Trigger `quizzes_set_updated_at` | Last rename |

**Constraints and indexes**

- `quizzes_pkey` on `id`.
- `quizzes_material_id_fkey` → `materials.id`.
- `quizzes_material_id_created_at_idx` on `(material_id, created_at DESC)`.
- `quizzes_display_name_nonblank_check`.

**Data quality expectations**

- A quiz is published fully formed inside one transaction (quiz + questions + options),
  never partially.
- A quiz is created only from a `READY` material with a confirmed extracted-text key.
- `display_name` is the only mutable field; questions and options are immutable.
- A quiz with attempt history cannot be deleted because of `quiz_attempts`'s
  `ON DELETE RESTRICT`.

### 6.9 `quiz_questions`

Ordered prompts inside a quiz.

| Column | Type | Null | Default | Key / constraint | Description |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK | Question identifier |
| `quiz_id` | `uuid` | no | — | FK → `quizzes.id`, `ON DELETE CASCADE` | Parent quiz |
| `position` | `integer` | no | — | `CHECK > 0`; `UNIQUE (quiz_id, position)` | 1-based display order |
| `prompt` | `text` | no | — | Non-blank | Question text |
| `explanation` | `text` | yes | `NULL` | — | Optional answer rationale |

**Constraints and indexes**

- `quiz_questions_pkey` on `id`.
- `quiz_questions_quiz_id_fkey` → `quizzes.id`.
- `quiz_questions_quiz_id_position_key` unique on `(quiz_id, position)`.
- `quiz_questions_id_quiz_id_key` unique on `(id, quiz_id)` — target for the
  composite FK from `quiz_attempt_answers`.
- `quiz_questions_position_check`, `quiz_questions_prompt_nonblank_check`.
- Trigger `quiz_questions_immutable` rejects every `UPDATE`.

**Data quality expectations**

- At least one question per quiz is enforced by the application when creating the quiz.
- Positions are positive, unique within the quiz and never renumbered after publication.
- Prompts are non-blank.
- Rows are write-once; corrections require a new quiz.

### 6.10 `question_options`

Ordered answer choices for a question.

| Column | Type | Null | Default | Key / constraint | Description |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK | Option identifier |
| `question_id` | `uuid` | no | — | FK → `quiz_questions.id`, `ON DELETE CASCADE` | Parent question |
| `position` | `integer` | no | — | `CHECK > 0`; `UNIQUE (question_id, position)` | 1-based display order |
| `option_text` | `text` | no | — | Non-blank | Choice text |
| `is_correct` | `boolean` | no | `false` | Partial unique: at most one `true` per question | Correct-answer flag |

**Constraints and indexes**

- `question_options_pkey` on `id`.
- `question_options_question_id_fkey` → `quiz_questions.id`.
- `question_options_question_id_position_key` unique on `(question_id, position)`.
- `question_options_question_id_id_key` unique on `(question_id, id)` — target for the
  composite FK from `quiz_attempt_answers`.
- `question_options_one_correct_key` — partial unique index on `question_id`
  `WHERE is_correct`; at most one correct option per question.
- `question_options_position_check`,
  `question_options_option_text_nonblank_check`.
- Trigger `question_options_immutable` rejects every `UPDATE`.

**Data quality expectations**

- At least two options per question is enforced by the application before saving.
- Exactly one correct option is enforced before saving; the database guarantees it is
  never more than one.
- Positions are positive and unique within the question.
- The correct flag is never exposed by the quiz-taking endpoint before submission.
- Rows are write-once.

### 6.11 `quiz_attempts`

One submitted attempt per row; the grade is computed by PostgreSQL.

| Column | Type | Null | Default | Key / constraint | Description |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | PK | Attempt identifier |
| `quiz_id` | `uuid` | no | — | FK → `quizzes.id`, `ON DELETE RESTRICT` | Attempted quiz |
| `user_id` | `uuid` | no | — | FK → `users.id`, `ON DELETE RESTRICT` | Student who submitted |
| `submitted_at` | `timestamptz(6)` | no | `CURRENT_TIMESTAMP` | — | Submission time |
| `total_questions` | `integer` | no | — | `CHECK > 0` | Questions in the attempt |
| `correct_answers` | `integer` | no | — | `CHECK 0 … total_questions` | Server-derived correct count |
| `score_percent` | `numeric(5,2)` | no | generated | `GENERATED ALWAYS AS (...) STORED` | Derived percentage, not writable |

**Generated expression**

```sql
CASE
    WHEN total_questions > 0
        THEN round(100.0 * correct_answers / total_questions, 2)
    ELSE 0
END
```

**Constraints and indexes**

- `quiz_attempts_pkey` on `id`.
- `quiz_attempts_quiz_id_fkey` → `quizzes.id`, `ON DELETE RESTRICT`.
- `quiz_attempts_user_id_fkey` → `users.id`, `ON DELETE RESTRICT`.
- `quiz_attempts_id_quiz_id_key` unique on `(id, quiz_id)` — target for the composite
  FK from answers.
- `quiz_attempts_user_id_submitted_at_idx` on `(user_id, submitted_at DESC)`.
- `quiz_attempts_quiz_id_idx` for per-quiz history.
- `quiz_attempts_counts_check` — `total_questions > 0`, `0 ≤ correct_answers ≤
  total_questions`.
- Trigger `quiz_attempts_immutable` rejects every `UPDATE`.

**Data quality expectations**

- `correct_answers` and `score_percent` are derived on the server from the submitted
  options; client-provided scores are ignored.
- `score_percent` cannot be inserted or updated directly; PostgreSQL rejects it.
- One attempt represents one complete submission; corrections are new attempts.
- Attempts with `0` correct answers and `100.00` scores are both valid.
- A user can never be deleted while attempts exist; history is preserved.

### 6.12 `quiz_attempt_answers`

Per-question grading snapshot for an attempt.

| Column | Type | Null | Default | Key / constraint | Description |
| --- | --- | --- | --- | --- | --- |
| `attempt_id` | `uuid` | no | — | PK part; composite FK → `quiz_attempts` | Parent attempt |
| `quiz_id` | `uuid` | no | — | Composite FK → `quiz_attempts`, `quiz_questions` | Quiz scope for integrity |
| `question_id` | `uuid` | no | — | PK part; composite FK → `quiz_questions` | Answered question |
| `selected_option_id` | `uuid` | no | — | Composite FK → `question_options` | Chosen option |
| `is_correct` | `boolean` | no | — | — | Server-derived correctness |

**Constraints and indexes**

- Primary key `(attempt_id, question_id)` — one answer per question per attempt.
- `quiz_attempt_answers_attempt_id_quiz_id_fkey` →
  `quiz_attempts(id, quiz_id)` `ON DELETE CASCADE`.
- `quiz_attempt_answers_question_id_quiz_id_fkey` →
  `quiz_questions(id, quiz_id)` `ON DELETE RESTRICT`.
- `quiz_attempt_answers_selected_option_id_question_id_fkey` →
  `question_options(id, question_id)` `ON DELETE RESTRICT`.
- Trigger `quiz_attempt_answers_immutable` rejects every `UPDATE`.

**Data quality expectations**

- Composite foreign keys make it impossible to answer a question from a different quiz
  or to select an option that belongs to another question.
- Every answer is written in the same transaction as its attempt.
- `is_correct` mirrors the selected option's correctness and is never trusted from the
  client.
- Rows are immutable once written.

### 6.13 `v_user_quiz_progress` (view)

Read-only aggregate used by `GET /me/progress`. It has no Prisma model and is queried
with raw SQL.

| Column | Type | Description |
| --- | --- | --- |
| `user_id` | `uuid` | Student |
| `quiz_id` | `uuid` | Quiz |
| `workspace_id` | `uuid` | Workspace reached through quiz → material |
| `completed_attempts` | `integer` | Number of submitted attempts |
| `average_score_percent` | `numeric` | Mean of `score_percent` |
| `best_score_percent` | `numeric(5,2)` | Highest score |
| `latest_score_percent` | `numeric(5,2)` | Score of the most recent attempt |
| `last_completed_at` | `timestamptz(6)` | Latest submission time |

**Data quality expectations**

- The view is non-updatable (`GROUP BY`); it can never be written through.
- "Latest" is ordered by `(submitted_at DESC, id DESC)` so ties are deterministic.
- Only users/quizzes with at least one attempt appear; empty progress is represented by
  the absence of a row.
- The API filters by the authenticated user; `user_id` is never taken from the client.

---

## 7. Keys, relationships and referential actions

### 7.1 Primary keys

| Table | Primary key |
| --- | --- |
| `users` | `id` |
| `workspaces` | `id` |
| `materials` | `id` |
| `processing_jobs` | `id` |
| `study_guides` | `id` |
| `quizzes` | `id` |
| `quiz_questions` | `id` |
| `question_options` | `id` |
| `quiz_attempts` | `id` |
| `quiz_attempt_answers` | `(attempt_id, question_id)` |

### 7.2 Foreign keys and delete behaviour

| Child column(s) | Parent | On delete | Why |
| --- | --- | --- | --- |
| `workspaces.owner_user_id` | `users.id` | `CASCADE` | Removing a user removes their workspace tree, but attempts below restrict the user delete first |
| `materials.workspace_id` | `workspaces.id` | `CASCADE` | Materials do not outlive their workspace |
| `processing_jobs.material_id` | `materials.id` | `CASCADE` | Jobs are meaningless without the material |
| `study_guides.material_id` | `materials.id` | `CASCADE` | Guides are derived artifacts |
| `quizzes.material_id` | `materials.id` | `CASCADE` | Quizzes are derived artifacts, but attempts restrict deletion |
| `quiz_questions.quiz_id` | `quizzes.id` | `CASCADE` | Questions belong to a quiz |
| `question_options.question_id` | `quiz_questions.id` | `CASCADE` | Options belong to a question |
| `quiz_attempts.quiz_id` | `quizzes.id` | **`RESTRICT`** | Never silently erase assessment history |
| `quiz_attempts.user_id` | `users.id` | **`RESTRICT`** | Never silently erase a student's history |
| `quiz_attempt_answers.(attempt_id, quiz_id)` | `quiz_attempts.(id, quiz_id)` | `CASCADE` | Answers die with their attempt |
| `quiz_attempt_answers.(question_id, quiz_id)` | `quiz_questions.(id, quiz_id)` | **`RESTRICT`** | A question referenced by history cannot be removed |
| `quiz_attempt_answers.(selected_option_id, question_id)` | `question_options.(id, question_id)` | **`RESTRICT`** | A chosen option referenced by history cannot be removed |

The mix of `CASCADE` and `RESTRICT` implements the retention policy: derived content can
disappear with its parent, but submitted assessment data is protected. The API translates
the resulting foreign-key error into HTTP `409 Conflict` with an explanatory message.

### 7.3 Composite keys for cross-quiz integrity

`quiz_attempt_answers` carries `quiz_id` explicitly so that three composite foreign keys
can enforce the invariant "the attempt, the question and the selected option all belong
to the same quiz". This is stronger than validating the relationship in application code:

- `(attempt_id, quiz_id)` → `quiz_attempts(id, quiz_id)`
- `(question_id, quiz_id)` → `quiz_questions(id, quiz_id)`
- `(selected_option_id, question_id)` → `question_options(id, question_id)`

Any attempt to inject an option from another question or a question from another quiz
fails at the database boundary, even if a bug bypasses the service layer.

---

## 8. Normalisation (3NF)

| Normal form | How it is met |
| --- | --- |
| **1NF** | Every attribute is atomic: no arrays, no repeated groups, no JSON documents. Ordered concepts use an explicit `position` column, not a delimited string. |
| **2NF** | Every non-key attribute depends on the whole primary key. The only composite key is `(attempt_id, question_id)` in `quiz_attempt_answers`, whose non-key columns (`quiz_id`, `selected_option_id`, `is_correct`) describe that whole answer, not part of it. |
| **3NF** | No non-key attribute transitively depends on another non-key attribute. User e-mail and hash live in `users`, not copied onto workspaces; material metadata lives in `materials`; quiz names live in `quizzes`; scores are not copied between tables. |

Two deliberate, documented exceptions are **derived** rather than duplicated:

1. `quiz_attempts.score_percent` is a `GENERATED ... STORED` column computed from
   `correct_answers / total_questions`. It is maintained by PostgreSQL, cannot be
   written by the application, and exists so reports and the progress view do not
   recompute the formula inconsistently.
2. `v_user_quiz_progress` is a view, not a table. It stores nothing and is always
   consistent with the base tables.

Object storage keys are references, not duplicated content: the file itself is outside
the relational model by design, and PostgreSQL stores one immutable key per object.

---

## 9. Data integrity and transactions

### 9.1 Integrity enforced by the database

| Mechanism | Examples |
| --- | --- |
| **Entity integrity** | UUID primary keys on every table; composite PK on `quiz_attempt_answers` |
| **Referential integrity** | 12 foreign keys, including 3 composite FKs; `CASCADE` for derived data, `RESTRICT` for history |
| **Domain integrity** | Enum types for statuses/job types; `CHECK` for MIME type, size, non-blank text, positions, counters, lifecycle timestamps |
| **Uniqueness** | Case-insensitive unique e-mail; unique storage keys; unique `(quiz_id, position)` and `(question_id, position)`; partial unique "one active extraction" and "one correct option" |
| **Derived-value integrity** | Generated `score_percent`; trigger-owned `updated_at` |
| **Immutability** | `BEFORE UPDATE` triggers on `quiz_questions`, `question_options`, `quiz_attempts`, `quiz_attempt_answers`; `UPDATE` also revoked from `app_write` |
| **Temporal integrity** | `finished_at >= started_at`; terminal jobs require `finished_at`; running jobs require `started_at` |
| **State integrity** | `READY` material must have `extracted_text_key`; at most one active `EXTRACT_TEXT` job per material |

### 9.2 Trigger-owned `updated_at`

A single mechanism updates modification timestamps, avoiding a race between Prisma and
PostgreSQL:

```sql
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;
```

The trigger is attached to `users`, `workspaces`, `materials`, `study_guides` and
`quizzes`. `schema.prisma` intentionally does **not** declare `@updatedAt`, so there is
exactly one writer.

### 9.3 Transaction boundaries

PostgreSQL runs each statement in a transaction and the application uses explicit
transactions for multi-statement invariants. The default isolation level is
`READ COMMITTED`, which is sufficient for these flows.

**Attempt submission — all-or-nothing**

```text
BEGIN
  validate quiz availability and ownership
  validate exactly one selected option per question
  derive is_correct from question_options
  INSERT quiz_attempts (total_questions, correct_answers)
  INSERT quiz_attempt_answers (one row per question)
COMMIT
```

If any answer is invalid, the whole attempt rolls back. No attempt can exist without its
answers, and no partial grading is visible. `score_percent` is computed by the same
`INSERT` that creates the attempt.

**Quiz creation — all-or-nothing**

```text
BEGIN
  INSERT quizzes
  INSERT quiz_questions (ordered)
  INSERT question_options (at least two, exactly one correct)
COMMIT
```

A provider response that fails validation never produces a visible partial quiz.

**Job claiming — concurrency-safe**

Workers claim the oldest queued job with `FOR UPDATE SKIP LOCKED`, so two workers cannot
process the same row:

```sql
WITH claimed AS (
    SELECT id
    FROM processing_jobs
    WHERE status = 'QUEUED'
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
UPDATE processing_jobs AS j
SET status = 'RUNNING', started_at = now()
FROM claimed
WHERE j.id = claimed.id
RETURNING j.*;
```

Because the queue is in PostgreSQL, a crash or restart does not lose work: queued and
running rows survive, and stale running jobs can be recovered by policy.

**External calls stay outside transactions**

Calls to R2, Apache Tika and the AI provider are **never** wrapped in a database
transaction. The pattern is:

1. Perform the external call.
2. After it succeeds, run a short transaction that records the result (key, status,
   job outcome).
3. On failure, record `FAILED` and a sanitized message, then clean up any orphaned
   object separately.

A long-running external call would otherwise hold locks and block the queue.

**Deletion**

Deletes run in a transaction. A `RESTRICT` violation on attempt history is caught and
surfaced as HTTP `409`; nothing is deleted. Deleting an eligible resource also schedules
cleanup of its R2 objects, because the database cannot roll back object storage.

### 9.4 Data integrity across the database/storage boundary

- A material row is inserted before or with its original object; an orphaned object is
  compensated or reconciled, never left untracked.
- `extracted_text_key` is written only after the `.txt` upload is confirmed.
- A guide row is written only after the Markdown upload is confirmed.
- Database commits are the source of truth for what the application may serve. An
  object without a committed metadata row is not user-visible.

---

## 10. Deployment and migrations

### 10.1 DDL location

The DDL is **not duplicated in this document**. The authoritative, version-controlled DDL
is:

| Migration | Contents |
| --- | --- |
| [`20261114121500_init/migration.sql`](../../Backend/prisma/migrations/20261114121500_init/migration.sql) | Schema, 3 enum types, 10 tables, 1 view, keys, indexes, `CHECK` constraints, triggers, generated column |
| [`20261115120000_roles_and_privileges/migration.sql`](../../Backend/prisma/migrations/20261115120000_roles_and_privileges/migration.sql) | `app_read` / `app_write` / `admin` roles, least-privilege grants, default privileges, `pgcrypto` |

Migration lock: [`migration_lock.toml`](../../Backend/prisma/migrations/migration_lock.toml)
(`provider = "postgresql"`).

### 10.2 Applying migrations

From `Backend/`:

```bash
npm install
cp .env.example .env                 # set DATABASE_URL
docker compose up -d db              # optional local PostgreSQL 17
npm run prisma:migrate               # prisma migrate deploy
npm run prisma:generate              # regenerate the Prisma client
npm run prisma:migrate:status        # verify applied/pending state
```

`prisma migrate deploy` applies every pending migration in filename order and records it
in `_prisma_migrations`. Migrations are the only supported way to create or change the
structure; no manual DDL is used in development, CI or production.

The roles/grants migration creates PostgreSQL roles and must run with a database owner
or superuser (the CI/deployment migration job). This is a deployment-time account only:
the NestJS runtime connects as a non-superuser login that inherits `app_write`
(Section 12).

### 10.3 Rules for new migrations

- Commit every migration to Git together with any `schema.prisma` change.
- Migrations are **forward-only**. Recovery uses a backup/point-in-time restore, not
  destructive down-migrations.
- Do **not** run `prisma migrate dev` against a populated database: the generated
  `score_percent` column is not representable in Prisma and Prisma reports expected drift
  and may offer a reset. Author migrations with `prisma migrate diff` or by hand and
  apply them with `prisma migrate deploy`.
- Never edit an already-applied migration; its checksum is recorded.
- After adding any table, view, function or sequence, update role grants (Section 12.5).
- Test migrations on an empty database and on a populated copy before release.

---

## 11. Test data

### 11.1 Seed script

[`Backend/prisma/seed.sql`](../../Backend/prisma/seed.sql) loads deterministic fixtures in a
single transaction and is idempotent (fixed UUIDs + `ON CONFLICT DO NOTHING`).

```bash
# from Backend/, as a role allowed to INSERT into all tables (for example admin)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/seed.sql
```

Demo accounts, local development only:

| User | E-mail | Password |
| --- | --- | --- |
| Alice | `alice@example.com` | `StudyDemo!2026` |
| Bob | `bob@example.com` | `StudyDemo!2026` |
| Carol | `carol@example.com` | `StudyDemo!2026` |

Only a bcrypt hash is stored in `users.password_hash`; the plaintext is an input to
`pgcrypto.crypt()` at seed time and is never written to a table.

### 11.2 What the fixtures cover

| Area | Records | Edge cases demonstrated |
| --- | --- | --- |
| Users | 3 | A user with no workspaces (Carol) |
| Workspaces | 4 | An empty workspace; two owners |
| Materials | 7 | All four processing statuses; 1-byte minimum; exactly 10 MiB maximum; PDF and DOCX |
| Processing jobs | 9 | `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`; failed AI job followed by a successful retry; failed extraction with a retained original |
| Study guides | 2 | Guides attached to different materials |
| Quizzes | 3 | One quiz with no attempts; two owners |
| Questions / options | 7 / 19 | Every question has 2–3 options and exactly one correct |
| Attempts | 4 | Scores 0/3, 2/3, 3/3, 1/2; three attempts on one quiz |
| Answers | 11 | Correct and incorrect selections, all inside the correct quiz |

Expected progress row for Alice on "Algorithms basics":

| completed_attempts | average_score_percent | best_score_percent | latest_score_percent |
| --- | --- | --- | --- |
| 3 | 55.5566666666666667 | 100.00 | 0.00 |

This exercises the view's count, average, best and latest semantics, including a
zero-score attempt.

### 11.3 Reference data

Three PostgreSQL enum types (`material_processing_status`, `processing_job_type`,
`processing_job_status`) hold the fixed reference values. They are created by the initial
migration rather than inserted by the seed, so every environment has identical values
before any application data exists. If a future lookup table is added, its fixed rows
belong in `seed.sql` with `ON CONFLICT DO NOTHING`.

### 11.4 Reset

For a disposable local database, recreate it and re-run migrations + seed:

```bash
npx prisma migrate reset --force   # drops and recreates the database, applies migrations
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/seed.sql
```

Never run `migrate reset` against shared or production data.

---

## 12. Roles and access rights

### 12.1 Role model

The roles are created by
[`20261115120000_roles_and_privileges/migration.sql`](../../Backend/prisma/migrations/20261115120000_roles_and_privileges/migration.sql).
They are `NOLOGIN` group roles; login accounts are separate and inherit them.

| Role | Login | Privileges | Intended use |
| --- | --- | --- | --- |
| `app_read` | no | `USAGE` on schema, `SELECT` on all current and default tables/views | Reporting, read-only support, analytics |
| `app_write` | no | `SELECT` everywhere; `INSERT/UPDATE/DELETE` on `users`, `workspaces`, `materials`, `processing_jobs`, `study_guides`, `quizzes`; `INSERT/DELETE` (no `UPDATE`) on quiz structure and attempts | The NestJS runtime (`DATABASE_URL`) |
| `admin` | no | `ALL` on tables, sequences and functions; `CREATE` on schema and database | Migrations, operations, seed data |

`PUBLIC` loses `CREATE` on the `public` schema, `CREATE`/`TEMPORARY` on the database, and
all object privileges. Nothing is accessible without an explicit grant.

### 12.2 Creating login accounts

The application must **never** connect as `postgres` or another superuser. Create one
login per use case and assign a group role:

```sql
-- Run as a superuser or the database owner.
CREATE ROLE app_user LOGIN IN ROLE app_write;
\password app_user          -- psql prompts and sends only a SCRAM-SHA-256 verifier

CREATE ROLE reporting_user LOGIN IN ROLE app_read;
\password reporting_user

CREATE ROLE dba LOGIN IN ROLE admin;
\password dba
```

Then point the backend at the application account:

```dotenv
DATABASE_URL="postgresql://app_user:...@localhost:5432/diploma_project?schema=public"
```

Verify that the runtime is not a superuser:

```sql
SELECT current_user, session_user, rolsuper
FROM pg_roles
WHERE rolname = current_user;
```

`rolsuper` must be `false`. `app_user` cannot create roles, bypass row security, or read
files through `pg_read_file`.

### 12.3 Password storage

- Passwords are stored **only** as a one-way salted hash in `users.password_hash`.
- Recommended: **Argon2id** (OWASP default: ≥ 19 MiB memory, ≥ 2 iterations, parallelism
  1). The column is `text`, so a standard PHC string such as
  `$argon2id$v=19$m=19456,t=2,p=1$...` fits without migration.
- **bcrypt** (cost ≥ 12) is acceptable and is what the test fixtures use through
  `pgcrypto`'s `gen_salt('bf', 12)`. bcrypt hashes also fit in `text`.
- MD5, SHA-1, SHA-256 (unsalted/fast), plain text, reversible encryption and
  client-supplied hashes are forbidden.
- Password hashes are never logged, serialized in API responses, or included in error
  messages.
- Login accounts for PostgreSQL use SCRAM-SHA-256 via `\password`; no password is stored
  in a migration, seed file, `.env.example` or Git history.

### 12.4 Access rules enforced by the API

Database privileges are coarse-grained; ownership is enforced per request:

- Every workspace/material/guide/quiz query is scoped through `owner_user_id` /
  `workspace_id` to the authenticated user.
- User B cannot read, rename, download or retry User A's resources even with a guessed
  UUID; the query returns "not found", not the row.
- `user_id` for attempts and progress always comes from the session, never from the
  request body or query string.
- Quiz-taking responses omit `is_correct` and `explanation` until after submission.

### 12.5 Adding new database objects

`ALTER DEFAULT PRIVILEGES` covers objects created by the migration/owner role. Complete
this checklist for every new object:

1. Create it in a migration.
2. Grant `SELECT` to `app_read` and `app_write` (table/view).
3. Grant only the required DML to `app_write`; keep immutable history read-only.
4. Grant `ALL` to `admin`.
5. Grant `USAGE`/`SELECT` on new sequences to `app_write` and `admin`.
6. If the object is created by a different role, run the grants explicitly or repeat
   `ALTER DEFAULT PRIVILEGES FOR ROLE <creator> ...`.
7. Add a migration test that asserts the expected privileges, and verify with
   `has_table_privilege('app_write', 'new_table', 'UPDATE')` and friends.

---

## 13. Restrictions compliance

| Restriction | Status |
| --- | --- |
| No passwords in plain text | Complied. Only `password_hash` exists; test fixtures hash at insert time; PostgreSQL login passwords use SCRAM verifiers. |
| No CSV/Excel as the only data storage | Complied. PostgreSQL is the system of record; CSV/Excel is not used for application data. |
| No unstructured JSON without a designed model | Complied. The schema uses atomic columns and typed relationships. The only external documents are PDF/DOCX originals, extracted text and Markdown, which are stored as objects in R2, not as JSON in PostgreSQL. |
| No ignored data integrity | Complied. Primary/foreign keys, `NOT NULL`, `UNIQUE`, `CHECK`, partial unique indexes, generated columns, triggers and explicit transactions are documented in Sections 6–9. |

---

## 14. Data quality expectations (summary)

| Dimension | Expectation | Enforcement |
| --- | --- | --- |
| Completeness | Required business fields are `NOT NULL`; `READY` implies extracted text | `NOT NULL`, `CHECK` |
| Uniqueness | One account per e-mail regardless of case; one object key per record; one correct option; one answer per question per attempt | Functional/partial unique indexes, composite PK |
| Validity | Only PDF/DOCX; 1 B–10 MiB; positive positions; counters within bounds; valid enum values | `CHECK`, enum types |
| Consistency | Parent/child rows always agree; answers stay inside their quiz; scores match counts | Foreign keys, composite foreign keys, generated column |
| Timeliness | `updated_at` advances automatically; job timestamps follow lifecycle rules | Triggers, `CHECK` |
| Immutability | Published quiz structure and submitted attempts never change | `BEFORE UPDATE` triggers + revoked `UPDATE` |
| Auditability | Every attempt keeps its per-question answers and submission time | `quiz_attempt_answers`, `submitted_at` |
| Identifiability | Stable UUID keys, no personal data in object keys | UUID defaults, key conventions |
| Availability | Queued/running jobs survive restarts; no in-memory-only queue | `processing_jobs` table |
| Security | Least privilege, hashed passwords, no superuser runtime | Roles, grants, password policy |

---

## 15. Operational notes

- **Backups:** use `pg_dump`/point-in-time recovery for PostgreSQL. R2 objects need an
  independent lifecycle/backup policy; database restore and object restore must be
  reconciled by key.
- **Retention:** attempts are retained. Deleting a resource with attempts is blocked;
  a future retention feature needs an explicit archival design, not a silent cascade.
- **Monitoring:** track queued-job age, running-job duration, failed-job rate, orphaned
  objects and constraint violations. These are the main OLTP health indicators.
- **Migrations in CI:** apply migrations to an empty PostgreSQL service, run the seed,
  then run integration tests; fail the pipeline on drift or missing grants.
- **Schema changes:** follow Section 10.3 and Section 12.5; do not edit applied
  migrations.
