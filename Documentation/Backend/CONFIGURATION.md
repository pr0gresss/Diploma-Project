# Backend configuration

See `.env.example`:

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `PORT` | no | HTTP port (default `3000`) |
| `JWT_SECRET` | yes | Access-token signing secret, at least 32 characters |
| `JWT_ISSUER` | no | Token issuer (default `ai-study-workspace`) |
| `JWT_AUDIENCE` | no | Token audience (default `ai-study-workspace-api`) |
| `JWT_ACCESS_TTL` | no | Access-token lifetime (default `15m`) |
| `STORAGE_DRIVER` | no | `local` (default) or `s3` |
| `STORAGE_ROOT` | no | Local disk root (default `.storage`) |
| `S3_BUCKET` | with `s3` | Private bucket for materials, extracted text and guides |
| `S3_REGION` | no | S3 region (default `auto`, suitable for R2) |
| `S3_ENDPOINT` | no | S3-compatible endpoint, e.g. Cloudflare R2 |

S3 credentials are read from `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and,
optionally, `AWS_SESSION_TOKEN`. The storage layer uses the first-party
`@nestjs/storage` package: `LocalDisk` in development and `S3Disk` for S3/R2.

For Cloudflare bucket/token creation, private configuration, Docker setup and
connection testing, see [`R2 setup`](Storage/R2_SETUP.md).

Configuration is loaded by `@nestjs/config` from `Backend/.env` and validated with
Zod at startup. The Prisma client uses the `@prisma/adapter-pg` driver adapter and is
injected through the global `PrismaModule`.

For extraction variables, see [content extraction](CONTENT_EXTRACTION.md).
For AI variables, see [provider configuration](AI/LLM_CONFIGURATION.md).

[Backend reference](README.md)
