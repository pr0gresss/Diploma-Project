-- Application roles and least-privilege grants.
--
-- Three NOLOGIN group roles model the access levels required by the project:
--   app_read  - read-only reporting and support access (SELECT everywhere)
--   app_write - the NestJS runtime: SELECT everywhere, DML on mutable tables,
--               append/delete only on immutable assessment and quiz tables
--   admin     - database administration and migrations (full DML/DDL)
--
-- This migration contains no passwords. Login accounts are created separately by
-- an administrator with `\password` so PostgreSQL stores only a SCRAM-SHA-256
-- verifier. See Documentation/DATABASE.md, "Roles and access rights".

-- pgcrypto supplies gen_random_uuid() on older servers and bcrypt for the test
-- fixtures in prisma/seed.sql. gen_random_uuid() is built in from PostgreSQL 13;
-- the extension is still required by the seed script.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_read') THEN
        CREATE ROLE app_read NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_write') THEN
        CREATE ROLE app_write NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin') THEN
        CREATE ROLE admin NOLOGIN;
    END IF;
END
$$;

-- Nothing is reachable through PUBLIC. Every privilege is granted explicitly.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO app_read, app_write, admin;
GRANT CREATE ON SCHEMA public TO admin;

-- Read-only role: tables, the progress view and future objects.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_read;

-- Application role: read everything, write only where the domain allows it.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_write;
GRANT INSERT, UPDATE, DELETE ON TABLE
    users,
    workspaces,
    materials,
    processing_jobs,
    study_guides,
    quizzes
TO app_write;

-- Quiz structure and submitted grades are immutable at trigger level; revoking
-- UPDATE as well keeps that rule explicit in the privileged surface.
GRANT INSERT, DELETE ON TABLE
    quiz_questions,
    question_options,
    quiz_attempts,
    quiz_attempt_answers
TO app_write;

-- Administration role: full access for operators and migration tooling.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_write, admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO admin;

-- Objects created later by the migration/owner role inherit the same grants.
-- A new object created by any other role needs an explicit GRANT (see docs).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO app_read;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO app_write;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_write, admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO admin;

-- Only the three roles may connect; nobody may create schemas or temporary
-- objects in the database through PUBLIC.
DO $$
BEGIN
    EXECUTE format(
        'GRANT CONNECT ON DATABASE %I TO app_read, app_write, admin',
        current_database()
    );
    EXECUTE format(
        'GRANT CONNECT, CREATE ON DATABASE %I TO admin',
        current_database()
    );
    EXECUTE format(
        'REVOKE CREATE, TEMPORARY ON DATABASE %I FROM PUBLIC',
        current_database()
    );
END
$$;
