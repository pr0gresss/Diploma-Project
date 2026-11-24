# Start the backend

Requires Node.js 24+, npm 12, PostgreSQL, and Docker Compose if using the containers below.
Run these commands from the repository root in PowerShell.

## Run locally

1. Install dependencies and create the local configuration:

   ```powershell
   cd Backend
   npm ci
   if (!(Test-Path .env)) { Copy-Item .env.example .env }
   ```

2. Edit `.env`: set `DATABASE_URL` and a random `JWT_SECRET` of at least 32 characters.
   Keep `STORAGE_DRIVER=local` for local files, or configure R2 using the
   [storage guide](../Documentation/Backend/Storage/R2_SETUP.md).
   Keep an existing configured `.env` instead of overwriting it.

3. Start PostgreSQL if you do not already have a database:

   ```powershell
   # Open a second terminal at the repository root first.
   if (!(Test-Path CI/.env)) { Copy-Item CI/.env.example CI/.env }
   # Set POSTGRES_PASSWORD in CI/.env before running this command.
   docker compose --env-file CI/.env up -d db
   ```

   The root Compose file creates user `study` and database `study_workspace`.
   Set Backend/.env DATABASE_URL to
   `postgresql://study:YOUR_POSTGRES_PASSWORD@localhost:5432/study_workspace?schema=public`.
   Use the same password as CI/.env and its POSTGRES_PORT if changed.
   The Compose file exposes PostgreSQL on port 5432 by default. Skip this command
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
if (!(Test-Path CI/.env)) { Copy-Item CI/.env.example CI/.env }
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

## Step-by-step environment setup

Choose host development (`Backend/.env`) or the Docker stack (`CI/.env`).
They are separate files: Compose does not read Backend/.env. Preserve existing
values; never commit either file. Install Docker Desktop with Compose for the
database/Tika services. Host development additionally needs Node.js 24+ and npm 12.

### 1. Generate your own secrets

Run this command twice, using one result as JWT_SECRET and the other as the
database password. Paste each result only into the appropriate private env file:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Hex passwords can be used directly in DATABASE_URL. Other passwords require
URL-encoding reserved characters. For an existing PostgreSQL installation, obtain
its host, port, database, username and password from its administrator instead.

### 2. Fill the database and authentication settings

| Variable | Value/source |
| --- | --- |
| DATABASE_URL | Host backend only: connection URL for your database; use the Compose user/database shown above when using its db service |
| POSTGRES_PASSWORD | Compose only: generated database password; keep it consistent with the host connection URL |
| POSTGRES_PORT | Compose host port, default 5432; choose 5433 if 5432 is occupied |
| PORT | Host backend port, default 3000 |
| BACKEND_PORT / FRONTEND_PORT | Compose published ports, defaults 3000 / 8080 |
| JWT_SECRET | Your generated signing secret, at least 32 characters |
| JWT_ISSUER | Host default ai-study-workspace; Compose supplies this automatically |
| JWT_AUDIENCE | Host default ai-study-workspace-api; Compose supplies this automatically |
| JWT_ACCESS_TTL | Host default 15m; Compose supplies this automatically |

Changing POSTGRES_PASSWORD does not update credentials inside an already initialized
database volume. Use its existing password or deliberately rotate the database role
password; do not delete the volume to resolve a configuration mismatch.

### 3. Select document storage

For a local start, explicitly set STORAGE_DRIVER=local, including in CI/.env
(its example selects s3). Host storage uses STORAGE_ROOT=.storage; Compose supplies
/app/.storage and a persistent volume. No cloud credentials are needed in local mode.

For R2, create a private bucket and bucket-scoped Object Read & Write S3 credentials
using the [R2 setup guide](../Documentation/Backend/Storage/R2_SETUP.md). Fill:

| Variable | Value/source |
| --- | --- |
| STORAGE_DRIVER | s3 |
| S3_BUCKET | Exact private bucket name |
| S3_ENDPOINT | Service origin from the bucket's S3 API settings, without a bucket path |
| S3_REGION | auto for R2 |
| AWS_ACCESS_KEY_ID | R2 S3 Access Key ID from credential creation |
| AWS_SECRET_ACCESS_KEY | Matching S3 Secret Access Key, shown when created |
| AWS_SESSION_TOKEN | Leave empty for ordinary R2 credentials; only temporary credentials need it |

Original documents, extracted text and guides use the selected storage driver.

### 4. Configure extraction

For host development, start the Tika container from the local instructions and set
TIKA_URL=http://127.0.0.1:9998. TIKA_TIMEOUT_MS defaults to 60000.
Keep PROCESSING_WORKER_ENABLED=true for normal host operation. Compose supplies
http://tika:9998 automatically; TIKA_IMAGE optionally overrides its image.
Without a reachable Tika service, uploads cannot complete normal extraction.

### 5. Configure quiz generation

For the local Codex gateway, follow the
[gateway installation guide](../Documentation/Backend/AI/LLM_CONFIGURATION.md#local-windows-setup)
to install the pinned executable first. Then run from Backend:

```powershell
npm run ai:gateway:setup
npm run ai:gateway:login
npm run ai:gateway:start
```

Complete the displayed login flow and keep the gateway terminal running. In another
Backend terminal:

```powershell
npm run ai:gateway:check
npm run ai:gateway:model -- MODEL_ID_FROM_THE_LIST
npm run ai:gateway:check
```

Setup writes LLM_PROVIDER=codex_gateway, LLM_BASE_URL=http://127.0.0.1:8317/v1
and a generated LLM_API_KEY to Backend/.env. Model selection writes LLM_MODEL.
The key authenticates to your gateway; it is not a paid OpenAI API key. The model
must come from your authenticated gateway catalog. The catalog check does not
prove remaining account quota or successful generation.

For a Docker backend, copy the four LLM settings into CI/.env and use a gateway
address reachable from that container. A host gateway bound only to 127.0.0.1 is
not automatically reachable through host.docker.internal. Use a secured private
gateway deployment as described in the guide; the supplied stack does not include one.
Host development is the direct path for the supplied loopback gateway helper.

Alternatively, for direct OpenAI API access, obtain an API key from your OpenAI
API project and choose an accessible model. Set LLM_PROVIDER=openai,
LLM_BASE_URL=https://api.openai.com/v1, LLM_API_KEY and LLM_MODEL. API billing is
separate from the local gateway login.

| Optional setting | Default / purpose |
| --- | --- |
| LLM_TIMEOUT_MS | 45000; provider request timeout |
| LLM_MAX_CONTEXT_CHARS | 60000; input plus prompt/schema character budget, not tokens |
| LLM_MAX_OUTPUT_TOKENS | 8192; response token budget |

Missing model/key leaves generation unavailable with 503 ai_unavailable while
ordinary API operations can still work. A context-limit 400 requires checking
extraction and source length; increase the limit only within the model's capacity.

### 6. Start and verify

For host development, run the Prisma generation, migration and start commands
above from Backend. For Docker, use the complete-project command above from the
repository root. Restart the backend after changing configuration.

Open http://localhost:3000/docs/ (adjust the port if configured). Register an
account, sign in, create a workspace, upload a document and wait for READY before
generating a quiz. With R2 selected, verify that the uploaded document and extracted
text objects appear in the private bucket. Test generation separately from the
gateway catalog check. Docker diagnostics:

```powershell
docker compose --env-file CI/.env ps
docker compose --env-file CI/.env logs --tail 100 backend tika migrate
```

For a host frontend, follow the [frontend guide](../Documentation/Frontend/README.md).
Its current API base defaults to localhost:3000; adjust frontend configuration if
using another backend port. Do not assume the Docker frontend automatically uses
the /api proxy while this default is present.
