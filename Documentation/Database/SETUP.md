# Database initialization

PostgreSQL 17 is the system of record. Migrations create the schema, the
`v_user_quiz_progress` view, and the `app_read` / `app_write` / `admin` roles. Run the
steps below from the repository root after cloning.

```bash
cd Backend
npm install
cp .env.example .env         # DATABASE_URL points at the local Docker database

# 1. Start PostgreSQL 17
docker compose up -d db

# 2. Apply migrations (schema, view, roles and grants)
npm run prisma:migrate

# 3. Load deterministic seed data (idempotent, safe to rerun)
docker compose cp prisma/seed.sql db:/tmp/seed.sql
docker compose exec -T db psql -U postgres -d diploma_project -v ON_ERROR_STOP=1 -f /tmp/seed.sql

# 4. Regenerate the Prisma client if needed
npm run prisma:generate

# 5. Browse data and relationships
npm run prisma:studio        # opens http://localhost:5555
```

If `psql` is installed locally, the seed can be applied directly instead of the two
Docker commands:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/seed.sql
```

The fixtures cover all processing statuses, size boundaries, multiple quiz attempts and
an empty workspace. Demo accounts (local development only) are
`alice@example.com`, `bob@example.com` and `carol@example.com`, all with password
`StudyDemo!2026`.

To discard local data and start over:

```bash
npx prisma migrate reset --force   # drops and recreates the database, applies migrations
# then load the seed again with step 3
```

Useful database commands: `npm run prisma:migrate:status` (applied/pending migrations),
`npm run prisma:studio` (data browser). The full data dictionary, logical schema and
integrity rules are in [`Documentation/Database/DATABASE.md`](DATABASE.md); the ER
diagram is in [section 5.2](DATABASE.md#52-er-diagram).


[Database documentation](README.md)
