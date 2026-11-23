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

To run the complete container stack (frontend, backend, PostgreSQL and Tika),
see [`Documentation/Deployment/README.md`](Deployment/README.md). Its shared Compose file is at
[`docker-compose.yml`](../docker-compose.yml).

```bash
cd Backend
npm install
npm run prisma:generate      # generate the client explicitly
cp .env.example .env         # set DATABASE_URL
docker compose up -d db      # optional: local PostgreSQL
npm run prisma:migrate       # create schema, view and roles
npm run start:dev            # http://localhost:3000
```

For demo data and a database browser, see [database setup](Database/SETUP.md).

Useful scripts: `npm run build`, `npm test`, `npm run lint`, `npm run prisma:migrate`, `npm run prisma:studio`.
See `Backend/README.md` for details.

## Database initialization

See [database setup and seed data](Database/SETUP.md).

## Frontend

```bash
cd Frontend
npm install
npm start                    # http://localhost:4200
```

Useful scripts: `npm run build`, `npm test`.
See `Documentation/Frontend/README.md` for details.

## Documentation

- [AI provider configuration and Codex gateway](Backend/AI/LLM_CONFIGURATION.md)

- [`Documentation/Backend/AI/OPENAI_OAUTH.md`](Backend/AI/OPENAI_OAUTH.md) — consent-based
  OpenAI plan usage, typed quiz generation, setup and limitations.

- [`Documentation/Backend/API/README.md`](Backend/API/README.md) — Swagger/OpenAPI
  reference, examples, getting-started/integration guides and architecture.

- [`Documentation/Backend/Storage/R2_SETUP.md`](Backend/Storage/R2_SETUP.md) — Cloudflare R2 bucket
  creation, scoped credentials, backend/Docker configuration and connection checks.

- `Documentation/Database/DATABASE.md` — database design, data dictionary, logical schema,
  integrity rules, migrations, test data, and roles.
- `Backend/prisma/migrations/` — authoritative, versioned DDL.
- `Backend/prisma/seed.sql` — deterministic test data.
