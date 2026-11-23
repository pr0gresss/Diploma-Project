# Getting started

[Documentation home](../README.md) · [Integration tutorial](authenticated-request.md)

## Prerequisites

- Node.js 24+ and npm 12.
- PostgreSQL for actual authentication/user lookup.
- Docker Compose v2 only if using the container stack.
- R2 credentials only if `STORAGE_DRIVER=s3`; local storage works without R2.

## 1. Configure and build

From the repository root:

```powershell
cd Backend
npm ci
# Only copy if .env does not already exist:
Copy-Item .env.example .env
```

On Linux/macOS, use `cp .env.example .env`. Preserve an existing environment file.
Set `DATABASE_URL` and a random `JWT_SECRET`; keep `STORAGE_DRIVER=local` for
the simplest local start. For R2, see [R2 setup](../../Storage/R2_SETUP.md).

```sh
npm run prisma:generate
npm run prisma:migrate
npm run build
```

For deterministic local demo accounts, initialize fixtures using the seed
instructions in the [project README](../../../PROJECT.md#database-initialization).
Never load demo accounts into production.

## 2. Start the backend

```sh
npm run start:dev
```

Default base URL: `http://localhost:3000`. Open
http://localhost:3000/docs/ to see Swagger. The specification is also available
at `/docs-json` and `/docs-yaml`.

The documentation assets are accessible without a token. The application root
route is protected, so this is expected:

```sh
curl -i http://localhost:3000/
```

```json
{"message":"Unauthorized","statusCode":401,"errorCode":"missing_credentials"}
```

In Windows PowerShell, use `curl.exe` rather than the legacy `curl` alias.

## 3. Make an authenticated request

Follow the [authentication integration tutorial](authenticated-request.md).
Register at `POST /auth/register` or sign in at `POST /auth/sign-in`, then use
the returned access token on protected operations.

## 4. Use Docker instead

Follow [`Documentation/Deployment/README.md`](../../../Deployment/README.md) to configure secrets and start the
stack. The UI is then http://localhost:8080/api/docs/. Select the `/api` server
before using Swagger's **Try it out**.

Docker's database and JWT secret are separate from those in `Backend/.env`.
Sign in against the same backend you are calling; a host-issued token does not
automatically work in Docker. Both backends expose the same HTTP operations.

## 5. Verify the documentation

From `Backend/`:

```sh
npm run docs:check
```

This verifies the committed specification against decorators, validates OpenAPI
with Redocly, and checks real HTTP responses with an isolated fake user lookup.
It is not a test of your production database.
