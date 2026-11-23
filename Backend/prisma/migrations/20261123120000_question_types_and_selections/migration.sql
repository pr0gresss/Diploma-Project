-- Additive migration: no quiz, option, attempt, answer, score or timestamp is
-- deleted/updated. Existing questions remain SINGLE_CHOICE.
BEGIN;
CREATE TYPE quiz_question_type AS ENUM ('SINGLE_CHOICE', 'SELECT', 'MULTI_SELECT');
ALTER TABLE quiz_questions ADD COLUMN question_type quiz_question_type NOT NULL DEFAULT 'SINGLE_CHOICE';

CREATE TABLE quiz_attempt_answer_selections (
    attempt_id uuid NOT NULL,
    question_id uuid NOT NULL,
    selected_option_id uuid NOT NULL,
    PRIMARY KEY (attempt_id, question_id, selected_option_id),
    FOREIGN KEY (attempt_id, question_id)
        REFERENCES quiz_attempt_answers(attempt_id, question_id) ON DELETE CASCADE ON UPDATE NO ACTION,
    FOREIGN KEY (question_id, selected_option_id)
        REFERENCES question_options(question_id, id) ON DELETE RESTRICT ON UPDATE NO ACTION
);

INSERT INTO quiz_attempt_answer_selections (attempt_id, question_id, selected_option_id)
SELECT attempt_id, question_id, selected_option_id FROM quiz_attempt_answers;

CREATE TRIGGER quiz_attempt_answer_selections_immutable
BEFORE UPDATE ON quiz_attempt_answer_selections
FOR EACH ROW EXECUTE FUNCTION reject_row_update();

-- This old partial unique index cannot represent multiple correct options.
-- Deferred checks below replace it for all three question types.
DROP INDEX question_options_one_correct_key;

CREATE FUNCTION validate_question_options() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    question uuid;
    kind quiz_question_type;
    option_count integer;
    correct_count integer;
BEGIN
    IF TG_TABLE_NAME = 'quiz_questions' THEN
        question := COALESCE(NEW.id, OLD.id);
    ELSE
        question := COALESCE(NEW.question_id, OLD.question_id);
    END IF;
    SELECT question_type INTO kind FROM quiz_questions WHERE id = question;
    IF NOT FOUND THEN RETURN NULL; END IF;
    SELECT count(*), count(*) FILTER (WHERE is_correct)
        INTO option_count, correct_count FROM question_options WHERE question_id = question;
    IF option_count < 2 OR option_count > 10 OR correct_count < 1
        OR (kind <> 'MULTI_SELECT' AND correct_count <> 1) THEN
        RAISE EXCEPTION 'Invalid options/correctness for question type %', kind USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER question_type_options_check
AFTER INSERT OR UPDATE ON quiz_questions DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_question_options();
CREATE CONSTRAINT TRIGGER question_options_cardinality_check
AFTER INSERT OR UPDATE OR DELETE ON question_options DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_question_options();

CREATE FUNCTION validate_answer_selections() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    attempt uuid := COALESCE(NEW.attempt_id, OLD.attempt_id);
    question uuid := COALESCE(NEW.question_id, OLD.question_id);
    kind quiz_question_type;
    representative uuid;
    stored_correct boolean;
    selected_count integer;
    expected_count integer;
    incorrect_count integer;
BEGIN
    SELECT q.question_type, a.selected_option_id, a.is_correct
        INTO kind, representative, stored_correct
        FROM quiz_attempt_answers a JOIN quiz_questions q ON q.id = a.question_id
        WHERE a.attempt_id = attempt AND a.question_id = question;
    IF NOT FOUND THEN RETURN NULL; END IF;
    SELECT count(*), count(*) FILTER (WHERE NOT o.is_correct)
        INTO selected_count, incorrect_count
        FROM quiz_attempt_answer_selections s
        JOIN question_options o ON o.id = s.selected_option_id
        WHERE s.attempt_id = attempt AND s.question_id = question;
    SELECT count(*) INTO expected_count FROM question_options
        WHERE question_id = question AND is_correct;
    IF selected_count < 1 OR selected_count > 10
        OR (kind <> 'MULTI_SELECT' AND selected_count <> 1)
        OR NOT EXISTS (
            SELECT 1 FROM quiz_attempt_answer_selections s
            WHERE s.attempt_id = attempt AND s.question_id = question
              AND s.selected_option_id = representative
        )
        OR stored_correct <> (selected_count = expected_count AND incorrect_count = 0) THEN
        RAISE EXCEPTION 'Invalid answer selections or correctness' USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER answer_selections_check
AFTER INSERT ON quiz_attempt_answers DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_answer_selections();
CREATE CONSTRAINT TRIGGER selection_cardinality_check
AFTER INSERT OR DELETE ON quiz_attempt_answer_selections DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_answer_selections();

GRANT SELECT ON quiz_attempt_answer_selections TO app_read;
GRANT SELECT, INSERT, DELETE ON quiz_attempt_answer_selections TO app_write;
GRANT ALL ON quiz_attempt_answer_selections TO admin;
GRANT EXECUTE ON FUNCTION validate_question_options(), validate_answer_selections() TO admin;

CREATE UNIQUE INDEX processing_jobs_one_active_quiz_generation
ON processing_jobs(material_id) WHERE job_type = 'GENERATE_QUIZ' AND status IN ('QUEUED', 'RUNNING');
COMMIT;
