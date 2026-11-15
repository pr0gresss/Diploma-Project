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
npm run start:dev            # http://localhost:3000
```

Useful scripts: `npm run build`, `npm test`, `npm run lint`, `npm run prisma:migrate`, `npm run prisma:studio`.
See `Backend/README.md` for details.

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
