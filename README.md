# AI Study Workspace

Bachelor diploma project: an AI-assisted study workspace.

```
.
├── Backend/         # NestJS 12 + Prisma 7 + PostgreSQL
├── Frontend/        # Angular 22 + SCSS
├── Documentation/   # Project documentation and handoff notes
└── README.md
```

Each application is self-contained: dependencies, scripts, configuration and ignore rules live inside its own folder. There is no root package manager manifest.

## Prerequisites

- Node.js **>= 24** and npm **12**
- Docker (optional, for local PostgreSQL)

## Backend

```bash
cd Backend
npm install                  # also generates the Prisma client
cp .env.example .env         # set DATABASE_URL
docker compose up -d db      # optional: local PostgreSQL
npm run prisma:migrate       # create schema, view and roles
npm run start:dev            # http://localhost:3000
```

For demo data and a database browser, see [Database initialization](#database-initialization).

Useful scripts: `npm run build`, `npm test`, `npm run lint`, `npm run prisma:migrate`, `npm run prisma:studio`.
See `Backend/README.md` for details.

## Database initialization

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
integrity rules are in [`Documentation/DATABASE.md`](Documentation/DATABASE.md); the ER
diagram is in [section 5.2](Documentation/DATABASE.md#52-er-diagram).

## Frontend

```bash
cd Frontend
npm install
npm start                    # http://localhost:4200
```

Useful scripts: `npm run build`, `npm test`.
See `Frontend/README.md` for details.

## Documentation

- `Documentation/DATABASE.md` — database design, data dictionary, logical schema,
  integrity rules, migrations, test data, and roles.
- `Backend/prisma/migrations/` — authoritative, versioned DDL.
- `Backend/prisma/seed.sql` — deterministic test data.
