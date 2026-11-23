# Start the backend

Requires Node.js 24+, npm 12, PostgreSQL, and Docker Compose if using the containers below.
Run these commands from the repository root in PowerShell.

## Run locally

1. Install dependencies and create the local configuration:

   ```powershell
   cd Backend
   npm ci
   Copy-Item .env.example .env
   ```

2. Edit `.env`: set `DATABASE_URL` and a random `JWT_SECRET` of at least 32 characters.
   Keep `STORAGE_DRIVER=local` for local files, or configure R2 using the
   [storage guide](../Documentation/Backend/Storage/R2_SETUP.md).
   Keep an existing configured `.env` instead of overwriting it.

3. Start PostgreSQL if you do not already have a database:

   ```powershell
   docker compose up -d db
   ```

   The backend Compose file exposes PostgreSQL on port 5432. Skip this command
   if another database is already using that port, and point `DATABASE_URL` at it.

4. Start Tika if it is not already available:

   ```powershell
   docker run -d --name study-tika -p 127.0.0.1:9998:9998 apache/tika:latest-full
   ```

   Set `TIKA_URL=http://127.0.0.1:9998` in `.env`. Without `TIKA_URL`,
   uploaded documents stay queued for extraction.

5. Generate Prisma, apply migrations, and start the backend:

   ```powershell
   npm run prisma:generate
   npm run prisma:migrate:deploy
   npm run start:dev
   ```

Backend: http://localhost:3000. Swagger UI: http://localhost:3000/docs/.
Restart the backend after changing `.env`.

To run the compiled backend:

```powershell
npm run build
npm run start:prod
```

## Run the complete project in Docker

From the repository root:

```powershell
Copy-Item CI/.env.example CI/.env
# Edit CI/.env: set POSTGRES_PASSWORD, JWT_SECRET, and storage settings.
docker compose --env-file CI/.env up --build -d
docker compose --env-file CI/.env ps
```

Frontend: http://localhost:8080. Backend: http://localhost:3000.
The stack configures PostgreSQL, migrations, and Tika automatically.
For operations and demo data, see the [deployment guide](../Documentation/Deployment/README.md).

All other documentation is in the [documentation index](../Documentation/README.md),
including the [backend reference](../Documentation/Backend/README.md),
[database guides](../Documentation/Database/README.md), and
[frontend setup](../Documentation/Frontend/README.md).
