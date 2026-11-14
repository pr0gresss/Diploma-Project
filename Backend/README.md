# Backend — NestJS API

NestJS 12 REST API with Prisma 7 and PostgreSQL, part of the AI Study Workspace monorepo.

## Structure

```
src/
├── app.module.ts     # root module (ConfigModule + PrismaModule)
├── app.controller.ts
├── app.service.ts
├── main.ts           # bootstrap
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
└── generated/prisma/ # Prisma Client output (git-ignored)
prisma/
└── schema.prisma
prisma7.config.ts     # Prisma CLI config (schema, migrations, datasource)
```

## Setup

From this folder:

```bash
npm install
cp .env.example .env        # then set DATABASE_URL
docker compose up -d db     # optional: local PostgreSQL
```

## Commands

Run from this folder:

| Command | Description |
| --- | --- |
| `npm run start:dev` | Watch mode on http://localhost:3000 |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run the compiled app |
| `npm run lint` | oxlint (type-aware) |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Vitest e2e tests |
| `npm run prisma:generate` | Regenerate the Prisma client |
| `npm run prisma:migrate` | Create/apply a development migration |
| `npm run prisma:studio` | Open Prisma Studio |

## Environment

See `.env.example`:

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `PORT` | no | HTTP port (default `3000`) |

Configuration is loaded by `@nestjs/config` from `.env` in this folder. The Prisma client uses the `@prisma/adapter-pg` driver adapter and is injected through the global `PrismaModule`.
