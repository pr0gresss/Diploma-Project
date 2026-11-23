# Backend — NestJS API

NestJS 12 REST API with Prisma 7 and PostgreSQL, part of the AI Study Workspace monorepo.

## Structure

Typed quiz generation uses a configurable OpenAI-compatible provider.
See [`Documentation/Backend/AI/LLM_CONFIGURATION.md`](AI/LLM_CONFIGURATION.md)
for the six `LLM_*` variables and optional external Codex-session gateway.

```
src/
├── app.module.ts     # root module (config, database, storage and all feature modules)
├── app.controller.ts
├── app.service.ts
├── main.ts           # JSON logger and bootstrap
├── common/           # domain errors, pagination, Prisma error mapping, structured logging
├── config/           # Zod environment validation
├── infrastructure/
│   ├── files/        # PDF/DOCX upload validation (MIME, extension, size, magic bytes)
│   └── storage/      # @nestjs/storage adapter (local disk in development, S3/R2 in production)
├── modules/
│   ├── auth/         # registration, sign-in, JWT bearer provider
│   ├── users/
│   ├── workspaces/
│   ├── materials/
│   ├── processing-jobs/
│   ├── study-guides/
│   ├── quizzes/
│   ├── attempts/
│   └── progress/     # raw-SQL report over v_user_quiz_progress
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
└── generated/prisma/ # Prisma Client output (git-ignored)
prisma/
├── schema.prisma     # data model (11 tables, 4 enums)
├── migrations/       # hand-reviewed SQL migrations (init + roles/grants)
├── seed.sql          # deterministic test data
prisma7.config.ts     # Prisma CLI config (schema, migrations, datasource)
```

## Guides

- [Start the backend](../../Backend/README.md)
- [Development commands and testing](DEVELOPMENT.md)
- [Environment configuration](CONFIGURATION.md)
- [Apache Tika content extraction](CONTENT_EXTRACTION.md)
- [Private storage and R2](Storage/README.md)
- [AI integrations](AI/README.md)
- [HTTP API reference](API/README.md)
- [Database documentation](../Database/README.md)
- [Service review and limitations](SERVICE_REVIEW.md)

[Documentation index](../README.md)
