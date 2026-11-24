# Start the project with the Docker Codex gateway

Run these commands in WSL, using the Docker context that manages your local
containers. Portainer can continue running. No separately installed host gateway,
host port mapping or Compose overlay is required.

## 1. Prepare configuration

```bash
cd /mnt/d/Projects/Diploma-Project
docker info
docker compose version
test -f CI/.env || cp CI/.env.example CI/.env
openssl rand -hex 32
```

Generate separate values for POSTGRES_PASSWORD, JWT_SECRET and CODEX_GATEWAY_KEY.
Edit CI/.env; preserve existing database credentials if its volume already exists:

```dotenv
POSTGRES_PASSWORD=YOUR_DATABASE_PASSWORD
JWT_SECRET=YOUR_RANDOM_SIGNING_SECRET
CODEX_GATEWAY_KEY=YOUR_RANDOM_GATEWAY_KEY
LLM_PROVIDER=codex_gateway
LLM_BASE_URL=http://codex-gateway:8317/v1
LLM_API_KEY=
LLM_MODEL=
STORAGE_DRIVER=local
```

Blank LLM_API_KEY makes Compose supply CODEX_GATEWAY_KEY to the backend. The key
must contain at least 32 letters, digits, underscores or hyphens. It authenticates
the backend to the gateway, not to OpenAI. Keep existing S3/R2 settings instead of
selecting local if you already use R2. Other settings are described in the
[backend startup guide](../../Backend/README.md).

## 2. Build and log in

```bash
docker compose --env-file CI/.env up --build -d codex-gateway
docker compose --env-file CI/.env exec codex-gateway \
  /CLIProxyAPI/CLIProxyAPI -config /CLIProxyAPI/config.yaml -codex-device-login
```

The first build downloads upstream v8.1.2 source and builds its Go binary; it
requires Internet access and can take several minutes. Open the device URL in
your browser and complete the displayed login. This is a separate gateway login;
an existing Codex CLI login is not automatically imported.

Authentication persists in the codex-gateway-auth named volume. The gateway API
has no published host port and is available to containers on the Compose network.

## 3. Start the backend and select a model

```bash
docker compose --env-file CI/.env up --build -d backend
docker compose --env-file CI/.env exec backend node --input-type=module -e '
const response = await fetch(process.env.LLM_BASE_URL + "/models", {
  headers: {Authorization: "Bearer " + process.env.LLM_API_KEY}
});
console.log("HTTP", response.status);
console.log(await response.text());
'
```

Set LLM_MODEL in CI/.env to an exact model ID returned by this request. A model
listing checks connectivity and login, not generation capability or remaining quota.

## 4. Start the complete project

```bash
docker compose --env-file CI/.env up --build -d
docker compose --env-file CI/.env ps
```

Compose recreates the backend when its environment changes. Open the frontend at
http://localhost:8080 and API documentation at http://localhost:3000/docs/.
Register/sign in, upload a document, wait for READY and generate a quiz. Account
eligibility and usage limits still apply.

Optional: set MOCK_USER_EMAIL and MOCK_USER_PASSWORD (12–128 characters) in CI/.env
and explicitly create one user:

```bash
docker compose --env-file CI/.env --profile tools run --build --rm seed-user
```

## Operations

```bash
docker compose --env-file CI/.env logs --tail 100 codex-gateway backend tika
docker compose --env-file CI/.env stop
docker compose --env-file CI/.env up -d
```

An empty catalog usually requires gateway login. A 401 can indicate mismatched
gateway/backend client keys. After changing CODEX_GATEWAY_KEY, recreate both
gateway and backend. Missing model configuration produces ai_unavailable;
generation can also fail due to provider quota or unsupported model capabilities.

Do not use down -v unless you intend to delete database, object-storage and gateway
login volumes. If you previously followed the separate overlay instructions, use
the integrated root Compose file going forward and complete this gateway's login.

The frontend uses the same-origin /api nginx proxy to backend:3000. Changing the
published BACKEND_PORT does not change this internal address. Container startup
alone does not verify the complete browser or quiz workflow.

Upstream references: [versioned configuration](https://github.com/router-for-me/CLIProxyAPI/blob/v8.1.2/config.example.yaml),
[Docker build](https://github.com/router-for-me/CLIProxyAPI/blob/v8.1.2/Dockerfile).
