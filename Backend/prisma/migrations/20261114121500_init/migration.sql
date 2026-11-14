-- Initial AI Study Workspace MVP schema.
--
-- Table/index/foreign-key statements are derived from prisma/schema.prisma.
-- The following parts are hand-reviewed SQL because Prisma cannot express them:
--   * functional unique index on lower(email)
--   * CHECK constraints (nonblank text, MIME type, file size, READY state, job
--     lifecycle timestamps, question/option positions, attempt counters)
--   * partial indexes (queued jobs, active extraction job, one correct option)
--   * GENERATED STORED score_percent column
--   * updated_at triggers
--   * read-only v_user_quiz_progress view
--
-- score_percent is a generated column, which Prisma cannot model. `prisma
-- migrate dev` therefore reports expected drift; apply migrations with
-- `prisma migrate deploy` and author new migrations deliberately.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "material_processing_status" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "processing_job_type" AS ENUM ('EXTRACT_TEXT', 'GENERATE_GUIDE', 'GENERATE_QUIZ');

-- CreateEnum
CREATE TYPE "processing_job_status" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(320) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "extracted_text_key" TEXT,
    "processing_status" "material_processing_status" NOT NULL DEFAULT 'UPLOADED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "material_id" UUID NOT NULL,
    "job_type" "processing_job_type" NOT NULL,
    "status" "processing_job_status" NOT NULL DEFAULT 'QUEUED',
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_guides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "material_id" UUID NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "storage_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "material_id" UUID NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quiz_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "explanation" TEXT,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "option_text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quiz_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_questions" INTEGER NOT NULL,
    "correct_answers" INTEGER NOT NULL,
    -- Hand-edited: database-computed grade; never writable by the application.
    -- The CASE guard keeps total_questions = 0 from raising division by zero
    -- before quiz_attempts_counts_check can report the documented violation.
    "score_percent" numeric(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN "total_questions" > 0
                THEN round(100.0 * "correct_answers" / "total_questions", 2)
            ELSE 0
        END
    ) STORED,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempt_answers" (
    "attempt_id" UUID NOT NULL,
    "quiz_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "selected_option_id" UUID NOT NULL,
    "is_correct" BOOLEAN NOT NULL,

    CONSTRAINT "quiz_attempt_answers_pkey" PRIMARY KEY ("attempt_id","question_id")
);

-- CreateIndex
CREATE INDEX "workspaces_owner_user_id_created_at_idx" ON "workspaces"("owner_user_id", "created_at" DESC);

-- CreateIndex
-- Hand-edited: case-insensitive login lookup and uniqueness. This is the only
-- e-mail uniqueness policy; no case-sensitive duplicate index is created.
CREATE UNIQUE INDEX "users_email_lower_key" ON "users"(lower("email"));

-- CreateIndex
CREATE UNIQUE INDEX "materials_storage_key_key" ON "materials"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "materials_extracted_text_key_key" ON "materials"("extracted_text_key");

-- CreateIndex
CREATE INDEX "materials_workspace_id_created_at_idx" ON "materials"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "processing_jobs_material_id_created_at_idx" ON "processing_jobs"("material_id", "created_at" DESC);

-- CreateIndex
-- Hand-edited: efficient claim of the oldest queued job.
CREATE INDEX "processing_jobs_queued_idx" ON "processing_jobs"("created_at" DESC) WHERE "status" = 'QUEUED';

-- CreateIndex
-- Hand-edited: at most one active extraction job per material.
CREATE UNIQUE INDEX "processing_jobs_active_extraction_key"
    ON "processing_jobs" ("material_id")
    WHERE "job_type" = 'EXTRACT_TEXT' AND "status" IN ('QUEUED', 'RUNNING');

-- CreateIndex
CREATE UNIQUE INDEX "study_guides_storage_key_key" ON "study_guides"("storage_key");

-- CreateIndex
CREATE INDEX "study_guides_material_id_created_at_idx" ON "study_guides"("material_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "quizzes_material_id_created_at_idx" ON "quizzes"("material_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "quiz_questions_quiz_id_position_key" ON "quiz_questions"("quiz_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_questions_id_quiz_id_key" ON "quiz_questions"("id", "quiz_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_question_id_position_key" ON "question_options"("question_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_question_id_id_key" ON "question_options"("question_id", "id");

-- CreateIndex
-- Hand-edited: single-correct-answer MVP; at most one correct option per question.
CREATE UNIQUE INDEX "question_options_one_correct_key"
    ON "question_options" ("question_id")
    WHERE "is_correct";

-- CreateIndex
CREATE INDEX "quiz_attempts_user_id_submitted_at_idx" ON "quiz_attempts"("user_id", "submitted_at" DESC);

-- CreateIndex
CREATE INDEX "quiz_attempts_quiz_id_idx" ON "quiz_attempts"("quiz_id");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_attempts_id_quiz_id_key" ON "quiz_attempts"("id", "quiz_id");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "study_guides" ADD CONSTRAINT "study_guides_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_attempt_id_quiz_id_fkey" FOREIGN KEY ("attempt_id", "quiz_id") REFERENCES "quiz_attempts"("id", "quiz_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_question_id_quiz_id_fkey" FOREIGN KEY ("question_id", "quiz_id") REFERENCES "quiz_questions"("id", "quiz_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_selected_option_id_question_id_fkey" FOREIGN KEY ("selected_option_id", "question_id") REFERENCES "question_options"("id", "question_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Hand-edited: nonblank text constraints.
ALTER TABLE "users"
    ADD CONSTRAINT "users_email_nonblank_check" CHECK (btrim("email") <> ''),
    ADD CONSTRAINT "users_password_hash_nonblank_check" CHECK (btrim("password_hash") <> '');

ALTER TABLE "workspaces"
    ADD CONSTRAINT "workspaces_name_nonblank_check" CHECK (btrim("name") <> '');

ALTER TABLE "materials"
    ADD CONSTRAINT "materials_original_filename_nonblank_check" CHECK (btrim("original_filename") <> ''),
    ADD CONSTRAINT "materials_display_name_nonblank_check" CHECK (btrim("display_name") <> ''),
    ADD CONSTRAINT "materials_storage_key_nonblank_check" CHECK (btrim("storage_key") <> ''),
    ADD CONSTRAINT "materials_extracted_text_key_nonblank_check" CHECK (
        "extracted_text_key" IS NULL OR btrim("extracted_text_key") <> ''
    ),
    ADD CONSTRAINT "materials_mime_type_check" CHECK (
        "mime_type" IN (
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
    ),
    ADD CONSTRAINT "materials_size_bytes_check" CHECK (
        "size_bytes" >= 1 AND "size_bytes" <= 10485760
    ),
    ADD CONSTRAINT "materials_ready_requires_extracted_text_check" CHECK (
        "processing_status" <> 'READY' OR "extracted_text_key" IS NOT NULL
    );

ALTER TABLE "processing_jobs"
    ADD CONSTRAINT "processing_jobs_running_requires_started_at_check" CHECK (
        "status" <> 'RUNNING' OR "started_at" IS NOT NULL
    ),
    ADD CONSTRAINT "processing_jobs_terminal_requires_finished_at_check" CHECK (
        "status" NOT IN ('SUCCEEDED', 'FAILED') OR "finished_at" IS NOT NULL
    ),
    ADD CONSTRAINT "processing_jobs_finished_after_started_check" CHECK (
        "started_at" IS NULL OR "finished_at" IS NULL OR "finished_at" >= "started_at"
    );

ALTER TABLE "study_guides"
    ADD CONSTRAINT "study_guides_display_name_nonblank_check" CHECK (btrim("display_name") <> ''),
    ADD CONSTRAINT "study_guides_storage_key_nonblank_check" CHECK (btrim("storage_key") <> '');

ALTER TABLE "quizzes"
    ADD CONSTRAINT "quizzes_display_name_nonblank_check" CHECK (btrim("display_name") <> '');

ALTER TABLE "quiz_questions"
    ADD CONSTRAINT "quiz_questions_position_check" CHECK ("position" > 0),
    ADD CONSTRAINT "quiz_questions_prompt_nonblank_check" CHECK (btrim("prompt") <> '');

ALTER TABLE "question_options"
    ADD CONSTRAINT "question_options_position_check" CHECK ("position" > 0),
    ADD CONSTRAINT "question_options_option_text_nonblank_check" CHECK (btrim("option_text") <> '');

ALTER TABLE "quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_counts_check" CHECK (
        "total_questions" > 0
        AND "correct_answers" >= 0
        AND "correct_answers" <= "total_questions"
    );

-- Hand-edited: updated_at is owned by PostgreSQL, not Prisma.
CREATE FUNCTION "set_updated_at"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW."updated_at" := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER "users_set_updated_at"
    BEFORE UPDATE ON "users"
    FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();

CREATE TRIGGER "workspaces_set_updated_at"
    BEFORE UPDATE ON "workspaces"
    FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();

CREATE TRIGGER "materials_set_updated_at"
    BEFORE UPDATE ON "materials"
    FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();

CREATE TRIGGER "study_guides_set_updated_at"
    BEFORE UPDATE ON "study_guides"
    FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();

CREATE TRIGGER "quizzes_set_updated_at"
    BEFORE UPDATE ON "quizzes"
    FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();

-- Hand-edited: quiz structure and submitted assessment rows are immutable.
-- Quizzes are published fully formed, so questions/options never change; an
-- attempt and its per-question answers are a persisted grading snapshot.
CREATE FUNCTION "reject_row_update"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '%.% rows are immutable', TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER "quiz_questions_immutable"
    BEFORE UPDATE ON "quiz_questions"
    FOR EACH ROW EXECUTE FUNCTION "reject_row_update"();

CREATE TRIGGER "question_options_immutable"
    BEFORE UPDATE ON "question_options"
    FOR EACH ROW EXECUTE FUNCTION "reject_row_update"();

CREATE TRIGGER "quiz_attempts_immutable"
    BEFORE UPDATE ON "quiz_attempts"
    FOR EACH ROW EXECUTE FUNCTION "reject_row_update"();

CREATE TRIGGER "quiz_attempt_answers_immutable"
    BEFORE UPDATE ON "quiz_attempt_answers"
    FOR EACH ROW EXECUTE FUNCTION "reject_row_update"();

-- Hand-edited: read-only progress view (GROUP BY makes it non-updatable). The
-- average is NUMERIC, matching AVG(numeric); best/latest keep NUMERIC(5,2).
CREATE VIEW "v_user_quiz_progress" AS
SELECT
    a."user_id" AS "user_id",
    a."quiz_id" AS "quiz_id",
    m."workspace_id" AS "workspace_id",
    COUNT(*)::integer AS "completed_attempts",
    AVG(a."score_percent") AS "average_score_percent",
    MAX(a."score_percent") AS "best_score_percent",
    (ARRAY_AGG(a."score_percent" ORDER BY a."submitted_at" DESC, a."id" DESC))[1] AS "latest_score_percent",
    MAX(a."submitted_at") AS "last_completed_at"
FROM "quiz_attempts" a
JOIN "quizzes" q ON q."id" = a."quiz_id"
JOIN "materials" m ON m."id" = q."material_id"
GROUP BY a."user_id", a."quiz_id", m."workspace_id";
