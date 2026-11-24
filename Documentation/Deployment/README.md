# Project containers

The root `docker-compose.yml` runs PostgreSQL, Apache Tika, the NestJS backend,
and the built Angular frontend. The repository's `CI/` folder contains their build/proxy configuration.
Docker Engine / Docker Desktop with Docker Compose v2 is required.

## Start

From the repository root:

```powershell
Copy-Item CI/.env.example CI/.env
# Edit CI/.env: set random POSTGRES_PASSWORD and JWT_SECRET.
# Fill the R2 credentials too, or set STORAGE_DRIVER=local.
# If local PostgreSQL is already running on 5432, set POSTGRES_PORT=5433.
docker compose --env-file CI/.env up --build -d
docker compose --env-file CI/.env ps
```

On Linux/macOS, use `cp CI/.env.example CI/.env` for the first command.

For private Cloudflare R2 storage, follow
[`Documentation/Backend/Storage/R2_SETUP.md`](../Backend/Storage/R2_SETUP.md). The Compose file
forwards the storage driver, endpoint, bucket and credentials to the backend.
The template defaults to R2 (`STORAGE_DRIVER=s3`); set `local` to run offline.

- Frontend: http://localhost:8080
- Backend: http://localhost:3000
- Backend through frontend proxy: http://localhost:8080/api/
- PostgreSQL: localhost:5432 (or the configured `POSTGRES_PORT`)
- Tika: `http://tika:9998` inside the Compose network only

The `migrate` container exits successfully after applying migrations. The backend
waits for that exit and the frontend waits for the backend listening socket.
The database container uses a separate volume and database from your host
PostgreSQL; existing host data is not imported or changed.

## Optional demo data

```sh
docker compose --env-file CI/.env --profile tools run --rm seed
```

The seed is idempotent. Demo accounts are `alice@example.com`, `bob@example.com`
and `carol@example.com`, password `StudyDemo!2026`. Seed rows do not include
actual PDF/DOCX/Markdown storage objects.

## Operations

```sh
docker compose --env-file CI/.env logs -f backend
docker compose --env-file CI/.env down
```

Stopping the stack retains database and object-storage volumes. Do not use
`down -v` unless you intend to permanently delete this stack's data.
Changing `POSTGRES_PASSWORD` after the database volume has been initialized does
not change the existing database user's password; rotate it in PostgreSQL too.

## Current limitations

- This is a single-host local/demo stack, not a hardened production deployment.
  The database bootstrap user also runs migrations and the backend; production
  needs separate migration and least-privilege runtime credentials.
- Local object storage is persisted in a named volume, suitable for one host.
  Use the backend's S3/R2 driver for distributed deployments.
- The backend polls extraction jobs when `TIKA_URL` is configured (the stack sets
  `http://tika:9998`). Successful extraction saves text privately and its object key in PostgreSQL;
  invalid or empty documents fail and can be retried through the API.
- Feature controllers are exposed through `/api/`, including authentication and
  study resources. Frontend application API integration is still pending.
- The backend health check checks TCP availability, not database health.
- Pin reviewed image versions/digests and resolve dependency advisories before
  production deployment. No telemetry account or paid service is required.
- `Backend/docker-compose.yml` remains the older database-only setup. Do not run
  it and this stack on the same host port simultaneously.
