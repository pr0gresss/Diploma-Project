CREATE TABLE quiz_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
 answers_json jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(answers_json) = 'array'),
 current_question_id uuid, revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 submitted_attempt_id uuid UNIQUE REFERENCES quiz_attempts(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX quiz_drafts_one_active ON quiz_drafts(user_id, quiz_id) WHERE submitted_attempt_id IS NULL;
CREATE INDEX quiz_drafts_user_id_quiz_id_idx ON quiz_drafts(user_id, quiz_id);
CREATE TRIGGER quiz_drafts_set_updated_at BEFORE UPDATE ON quiz_drafts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
GRANT SELECT ON quiz_drafts TO app_read;
GRANT SELECT, INSERT, UPDATE, DELETE ON quiz_drafts TO app_write;
GRANT ALL ON quiz_drafts TO admin;
