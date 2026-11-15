-- Test data for the AI Study Workspace database.
--
-- Run after `prisma migrate deploy`, as a role that may INSERT into every table
-- (for example the `admin` login):
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/seed.sql
--
-- The script is idempotent: fixed UUIDs plus ON CONFLICT DO NOTHING make a second
-- run a no-op. Everything executes in one transaction, so a partial fixture is
-- never committed.
--
-- Demo accounts (never use these credentials outside local development):
--   alice@example.com  / StudyDemo!2026
--   bob@example.com    / StudyDemo!2026
--   carol@example.com  / StudyDemo!2026
--
-- Only a bcrypt hash is stored in users.password_hash. The plaintext above is an
-- input to pgcrypto `crypt()` and is never written to a table.

\set ON_ERROR_STOP on

BEGIN;

SET LOCAL search_path = public;

-- ---------------------------------------------------------------------------
-- Users: two active students and one student with no workspaces (edge case).
-- ---------------------------------------------------------------------------
INSERT INTO users (id, email, password_hash, created_at, updated_at)
VALUES
    ('11111111-1111-4111-8111-111111111111', 'alice@example.com',
     crypt('StudyDemo!2026', gen_salt('bf', 12)),
     TIMESTAMPTZ '2026-10-20 09:00:00+00', TIMESTAMPTZ '2026-10-20 09:00:00+00'),
    ('22222222-2222-4222-8222-222222222222', 'bob@example.com',
     crypt('StudyDemo!2026', gen_salt('bf', 12)),
     TIMESTAMPTZ '2026-10-21 10:30:00+00', TIMESTAMPTZ '2026-10-21 10:30:00+00'),
    ('33333333-3333-4333-8333-333333333333', 'carol@example.com',
     crypt('StudyDemo!2026', gen_salt('bf', 12)),
     TIMESTAMPTZ '2026-10-22 11:45:00+00', TIMESTAMPTZ '2026-10-22 11:45:00+00')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Workspaces: one workspace with no materials is included as an edge case.
-- ---------------------------------------------------------------------------
INSERT INTO workspaces (id, owner_user_id, name, created_at, updated_at)
VALUES
    ('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
     'Algorithms', TIMESTAMPTZ '2026-10-20 09:05:00+00', TIMESTAMPTZ '2026-10-20 09:05:00+00'),
    ('a0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
     'Databases', TIMESTAMPTZ '2026-10-20 09:06:00+00', TIMESTAMPTZ '2026-10-20 09:06:00+00'),
    ('a0000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222',
     'Physics', TIMESTAMPTZ '2026-10-21 10:35:00+00', TIMESTAMPTZ '2026-10-21 10:35:00+00'),
    ('a0000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
     'Empty workspace', TIMESTAMPTZ '2026-10-23 08:00:00+00', TIMESTAMPTZ '2026-10-23 08:00:00+00')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Materials cover every processing status and the size boundary values
-- (1 byte and 10 MiB = 10485760 bytes).
-- ---------------------------------------------------------------------------
INSERT INTO materials (
    id, workspace_id, original_filename, display_name, mime_type, size_bytes,
    storage_key, extracted_text_key, processing_status, created_at, updated_at
)
VALUES
    ('c1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
     'algorithms-notes.pdf', 'Algorithms notes', 'application/pdf', 204800,
     'materials/c1000000-0000-4000-8000-000000000001/original.pdf',
     'materials/c1000000-0000-4000-8000-000000000001/extracted.txt',
     'READY', TIMESTAMPTZ '2026-11-01 09:00:00+00', TIMESTAMPTZ '2026-11-01 09:00:25+00'),
    ('c1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
     'one-byte.docx', 'One-byte upload edge case',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1,
     'materials/c1000000-0000-4000-8000-000000000002/original.docx',
     NULL, 'UPLOADED', TIMESTAMPTZ '2026-11-04 07:30:00+00', TIMESTAMPTZ '2026-11-04 07:30:00+00'),
    ('c1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002',
     'normalization.pdf', 'Normalization notes', 'application/pdf', 1048576,
     'materials/c1000000-0000-4000-8000-000000000003/original.pdf',
     NULL, 'PROCESSING', TIMESTAMPTZ '2026-11-05 13:00:00+00', TIMESTAMPTZ '2026-11-05 13:00:05+00'),
    ('c1000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002',
     'indexes.pdf', 'Indexes (failed extraction)', 'application/pdf', 524288,
     'materials/c1000000-0000-4000-8000-000000000004/original.pdf',
     NULL, 'FAILED', TIMESTAMPTZ '2026-11-04 08:00:00+00', TIMESTAMPTZ '2026-11-04 08:00:40+00'),
    ('c1000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001',
     'complexity-cheatsheet.pdf', 'Complexity cheat sheet', 'application/pdf', 10485760,
     'materials/c1000000-0000-4000-8000-000000000005/original.pdf',
     'materials/c1000000-0000-4000-8000-000000000005/extracted.txt',
     'READY', TIMESTAMPTZ '2026-11-03 13:50:00+00', TIMESTAMPTZ '2026-11-03 13:51:00+00'),
    ('c1000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000003',
     'kinematics.docx', 'Kinematics',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1048576,
     'materials/c1000000-0000-4000-8000-000000000006/original.docx',
     'materials/c1000000-0000-4000-8000-000000000006/extracted.txt',
     'READY', TIMESTAMPTZ '2026-11-06 08:50:00+00', TIMESTAMPTZ '2026-11-06 08:51:00+00'),
    ('c1000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001',
     'graph-theory.pdf', 'Graph theory', 'application/pdf', 4096,
     'materials/c1000000-0000-4000-8000-000000000008/original.pdf',
     NULL, 'UPLOADED', TIMESTAMPTZ '2026-11-05 12:00:00+00', TIMESTAMPTZ '2026-11-05 12:00:00+00')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Processing jobs: queued, running, succeeded and failed lifecycle states.
-- An AI failure (GENERATE_QUIZ on a READY material) must not change the
-- material's extraction status, so material 5 stays READY.
-- ---------------------------------------------------------------------------
INSERT INTO processing_jobs (
    id, material_id, job_type, status, error_message, created_at, started_at, finished_at
)
VALUES
    ('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
     'EXTRACT_TEXT', 'SUCCEEDED', NULL,
     TIMESTAMPTZ '2026-11-01 09:00:00+00', TIMESTAMPTZ '2026-11-01 09:00:10+00',
     TIMESTAMPTZ '2026-11-01 09:00:25+00'),
    ('c2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000008',
     'EXTRACT_TEXT', 'QUEUED', NULL,
     TIMESTAMPTZ '2026-11-05 12:00:00+00', NULL, NULL),
    ('c2000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000003',
     'EXTRACT_TEXT', 'RUNNING', NULL,
     TIMESTAMPTZ '2026-11-05 13:00:00+00', TIMESTAMPTZ '2026-11-05 13:00:05+00', NULL),
    ('c2000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000004',
     'EXTRACT_TEXT', 'FAILED', 'Extraction service returned empty text',
     TIMESTAMPTZ '2026-11-04 08:00:00+00', TIMESTAMPTZ '2026-11-04 08:00:10+00',
     TIMESTAMPTZ '2026-11-04 08:00:40+00'),
    ('c2000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001',
     'GENERATE_GUIDE', 'SUCCEEDED', NULL,
     TIMESTAMPTZ '2026-11-02 10:00:00+00', TIMESTAMPTZ '2026-11-02 10:00:02+00',
     TIMESTAMPTZ '2026-11-02 10:00:45+00'),
    ('c2000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000001',
     'GENERATE_QUIZ', 'SUCCEEDED', NULL,
     TIMESTAMPTZ '2026-11-02 11:00:00+00', TIMESTAMPTZ '2026-11-02 11:00:03+00',
     TIMESTAMPTZ '2026-11-02 11:00:50+00'),
    ('c2000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000005',
     'GENERATE_QUIZ', 'FAILED', 'AI provider returned invalid quiz structure',
     TIMESTAMPTZ '2026-11-03 14:00:00+00', TIMESTAMPTZ '2026-11-03 14:00:04+00',
     TIMESTAMPTZ '2026-11-03 14:00:30+00'),
    ('c2000000-0000-4000-8000-000000000008', 'c1000000-0000-4000-8000-000000000005',
     'GENERATE_QUIZ', 'SUCCEEDED', NULL,
     TIMESTAMPTZ '2026-11-03 14:10:00+00', TIMESTAMPTZ '2026-11-03 14:10:02+00',
     TIMESTAMPTZ '2026-11-03 14:10:50+00'),
    ('c2000000-0000-4000-8000-000000000009', 'c1000000-0000-4000-8000-000000000005',
     'GENERATE_GUIDE', 'SUCCEEDED', NULL,
     TIMESTAMPTZ '2026-11-03 14:04:00+00', TIMESTAMPTZ '2026-11-03 14:04:02+00',
     TIMESTAMPTZ '2026-11-03 14:04:40+00')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Study guides are metadata only; the Markdown body lives in private storage.
-- ---------------------------------------------------------------------------
INSERT INTO study_guides (id, material_id, display_name, storage_key, created_at, updated_at)
VALUES
    ('c3000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
     'Algorithms notes - study guide',
     'study-guides/c3000000-0000-4000-8000-000000000001/content.md',
     TIMESTAMPTZ '2026-11-02 10:00:45+00', TIMESTAMPTZ '2026-11-02 10:00:45+00'),
    ('c3000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000005',
     'Complexity review guide',
     'study-guides/c3000000-0000-4000-8000-000000000002/content.md',
     TIMESTAMPTZ '2026-11-03 14:04:40+00', TIMESTAMPTZ '2026-11-03 14:04:40+00')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Quizzes: quiz 2 has no attempts (left side of the progress aggregate is empty).
-- ---------------------------------------------------------------------------
INSERT INTO quizzes (id, material_id, display_name, created_at, updated_at)
VALUES
    ('c4000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
     'Algorithms basics', TIMESTAMPTZ '2026-11-02 11:00:50+00', TIMESTAMPTZ '2026-11-02 11:00:50+00'),
    ('c4000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000005',
     'Complexity review', TIMESTAMPTZ '2026-11-03 14:10:50+00', TIMESTAMPTZ '2026-11-03 14:10:50+00'),
    ('c4000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000006',
     'Kinematics', TIMESTAMPTZ '2026-11-06 09:00:00+00', TIMESTAMPTZ '2026-11-06 09:00:00+00')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Questions are ordered within a quiz; positions start at 1.
-- ---------------------------------------------------------------------------
INSERT INTO quiz_questions (id, quiz_id, position, prompt, explanation)
VALUES
    ('c5000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000001', 1,
     'What is the average-case time complexity of binary search?',
     'Binary search halves the search interval on every step.'),
    ('c5000000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000001', 2,
     'Which data structure uses FIFO ordering?',
     'Queues remove elements in the same order they were inserted.'),
    ('c5000000-0000-4000-8000-000000000003', 'c4000000-0000-4000-8000-000000000001', 3,
     'Which stable comparison sort has O(n log n) worst-case time?',
     'Merge sort is stable and guarantees O(n log n) comparisons.'),
    ('c5000000-0000-4000-8000-000000000004', 'c4000000-0000-4000-8000-000000000002', 1,
     'O(1) describes constant time.',
     'Constant time does not depend on the input size.'),
    ('c5000000-0000-4000-8000-000000000005', 'c4000000-0000-4000-8000-000000000002', 2,
     'Which function grows fastest asymptotically?',
     'Quadratic growth eventually dominates linear and linearithmic growth.'),
    ('c5000000-0000-4000-8000-000000000006', 'c4000000-0000-4000-8000-000000000003', 1,
     'What is the SI unit of acceleration?',
     'Acceleration is velocity change per unit time, therefore m/s^2.'),
    ('c5000000-0000-4000-8000-000000000007', 'c4000000-0000-4000-8000-000000000003', 2,
     'Velocity is a scalar quantity.',
     'Velocity has both magnitude and direction, so it is a vector.')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Options: exactly one correct option per question, at least two options.
-- ---------------------------------------------------------------------------
INSERT INTO question_options (id, question_id, position, option_text, is_correct)
VALUES
    ('c6000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 1, 'O(log n)', true),
    ('c6000000-0000-4000-8000-000000000002', 'c5000000-0000-4000-8000-000000000001', 2, 'O(n)', false),
    ('c6000000-0000-4000-8000-000000000003', 'c5000000-0000-4000-8000-000000000001', 3, 'O(n log n)', false),
    ('c6000000-0000-4000-8000-000000000004', 'c5000000-0000-4000-8000-000000000002', 1, 'Queue', true),
    ('c6000000-0000-4000-8000-000000000005', 'c5000000-0000-4000-8000-000000000002', 2, 'Stack', false),
    ('c6000000-0000-4000-8000-000000000006', 'c5000000-0000-4000-8000-000000000002', 3, 'Binary heap', false),
    ('c6000000-0000-4000-8000-000000000007', 'c5000000-0000-4000-8000-000000000003', 1, 'Merge sort', true),
    ('c6000000-0000-4000-8000-000000000008', 'c5000000-0000-4000-8000-000000000003', 2, 'Quicksort', false),
    ('c6000000-0000-4000-8000-000000000009', 'c5000000-0000-4000-8000-000000000003', 3, 'Selection sort', false),
    ('c6000000-0000-4000-8000-000000000010', 'c5000000-0000-4000-8000-000000000004', 1, 'True', true),
    ('c6000000-0000-4000-8000-000000000011', 'c5000000-0000-4000-8000-000000000004', 2, 'False', false),
    ('c6000000-0000-4000-8000-000000000012', 'c5000000-0000-4000-8000-000000000005', 1, 'O(n^2)', true),
    ('c6000000-0000-4000-8000-000000000013', 'c5000000-0000-4000-8000-000000000005', 2, 'O(n log n)', false),
    ('c6000000-0000-4000-8000-000000000014', 'c5000000-0000-4000-8000-000000000005', 3, 'O(n)', false),
    ('c6000000-0000-4000-8000-000000000015', 'c5000000-0000-4000-8000-000000000006', 1, 'm/s^2', true),
    ('c6000000-0000-4000-8000-000000000016', 'c5000000-0000-4000-8000-000000000006', 2, 'm/s', false),
    ('c6000000-0000-4000-8000-000000000017', 'c5000000-0000-4000-8000-000000000006', 3, 'N', false),
    ('c6000000-0000-4000-8000-000000000018', 'c5000000-0000-4000-8000-000000000007', 1, 'False', true),
    ('c6000000-0000-4000-8000-000000000019', 'c5000000-0000-4000-8000-000000000007', 2, 'True', false)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Attempts: a 2/3, a perfect 3/3 and a zero 0/3 attempt for Alice on quiz 1,
-- plus one 1/2 attempt for Bob on quiz 3. score_percent is generated by the
-- database and must not be supplied.
-- ---------------------------------------------------------------------------
INSERT INTO quiz_attempts (
    id, quiz_id, user_id, submitted_at, total_questions, correct_answers
)
VALUES
    ('c7000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000001',
     '11111111-1111-4111-8111-111111111111', TIMESTAMPTZ '2026-11-08 10:00:00+00', 3, 2),
    ('c7000000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000001',
     '11111111-1111-4111-8111-111111111111', TIMESTAMPTZ '2026-11-09 10:00:00+00', 3, 3),
    ('c7000000-0000-4000-8000-000000000003', 'c4000000-0000-4000-8000-000000000001',
     '11111111-1111-4111-8111-111111111111', TIMESTAMPTZ '2026-11-10 10:00:00+00', 3, 0),
    ('c7000000-0000-4000-8000-000000000004', 'c4000000-0000-4000-8000-000000000003',
     '22222222-2222-4222-8222-222222222222', TIMESTAMPTZ '2026-11-09 15:00:00+00', 2, 1)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Answers: one row per question per attempt. Composite foreign keys keep the
-- attempt, question and selected option inside the same quiz.
-- ---------------------------------------------------------------------------
INSERT INTO quiz_attempt_answers (
    attempt_id, quiz_id, question_id, selected_option_id, is_correct
)
VALUES
    ('c7000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000001',
     'c5000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000001', true),
    ('c7000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000001',
     'c5000000-0000-4000-8000-000000000002', 'c6000000-0000-4000-8000-000000000004', true),
    ('c7000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000001',
     'c5000000-0000-4000-8000-000000000003', 'c6000000-0000-4000-8000-000000000008', false),

    ('c7000000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000001',
     'c5000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000001', true),
    ('c7000000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000001',
     'c5000000-0000-4000-8000-000000000002', 'c6000000-0000-4000-8000-000000000004', true),
    ('c7000000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000001',
     'c5000000-0000-4000-8000-000000000003', 'c6000000-0000-4000-8000-000000000007', true),

    ('c7000000-0000-4000-8000-000000000003', 'c4000000-0000-4000-8000-000000000001',
     'c5000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000002', false),
    ('c7000000-0000-4000-8000-000000000003', 'c4000000-0000-4000-8000-000000000001',
     'c5000000-0000-4000-8000-000000000002', 'c6000000-0000-4000-8000-000000000005', false),
    ('c7000000-0000-4000-8000-000000000003', 'c4000000-0000-4000-8000-000000000001',
     'c5000000-0000-4000-8000-000000000003', 'c6000000-0000-4000-8000-000000000009', false),

    ('c7000000-0000-4000-8000-000000000004', 'c4000000-0000-4000-8000-000000000003',
     'c5000000-0000-4000-8000-000000000006', 'c6000000-0000-4000-8000-000000000015', true),
    ('c7000000-0000-4000-8000-000000000004', 'c4000000-0000-4000-8000-000000000003',
     'c5000000-0000-4000-8000-000000000007', 'c6000000-0000-4000-8000-000000000019', false)
ON CONFLICT DO NOTHING;

COMMIT;
