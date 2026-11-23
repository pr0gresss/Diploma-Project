# Cloudflare R2: private file storage

The backend supports R2 through the first-party `@nestjs/storage` S3 disk.
PostgreSQL still holds metadata and object keys; R2 holds uploaded documents,
extracted text and Markdown guides. No Cloudflare account credentials belong in
Angular, Git, screenshots, or chat.

## 1. Enable R2 and create a bucket

1. Sign in to https://dash.cloudflare.com/ and choose your account.
2. Open **Storage & databases → R2 Object Storage → Overview** (navigation labels
   can vary). Activate R2 if prompted. Cloudflare may require billing setup;
   review its usage limits and pricing before confirming:
   https://developers.cloudflare.com/r2/pricing/.
3. Select **Create bucket** and choose a name, e.g.
   `ai-study-workspace-private`.
4. Choose the location/jurisdiction that meets your data requirements.
5. Create the bucket and leave it **private**:
   do not enable a public `r2.dev` development URL or attach a public custom domain.
6. Open the bucket's **Settings** and find the **S3 API** endpoint. Copy the
   service origin, without a trailing bucket name or object path.

An ordinary endpoint looks like:

```text
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

Jurisdictional buckets need the matching endpoint, for example:

```text
https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com
```

Other jurisdiction endpoints may include `.us` or `.fedramp`. Copy what your
dashboard shows instead of constructing an endpoint for the wrong jurisdiction.
If the displayed S3 URL ends in `/your-bucket`, remove that path for `S3_ENDPOINT`.

## 2. Create scoped S3 credentials

1. Return to **R2 Object Storage → Overview**.
2. In **Account Details**, select **Manage** next to **API Tokens**.
3. Select **Create Account API token**, if your account role permits it.
   Alternatively select **Create User API token**. A user token stops working if
   that user loses account access; account tokens are preferable for deployments.
4. Give it a recognizable name, e.g. `study-workspace-backend-dev`.
5. Select **Object Read & Write**, not an Admin permission.
6. Apply it to **specific buckets only** and select your private bucket.
7. Set an expiration/rotation policy appropriate to your environment. Restrict
   source IPs only if your backend has a stable outgoing IP.
8. Create the token and copy the resulting **Access Key ID** and **Secret Access
   Key** to your private environment file or a password/secret manager.

**The Secret Access Key is shown only once.** If you lose it, create replacement
credentials. Do not use the general Cloudflare Global API Key or paste the raw
Cloudflare API token in place of the S3 Secret Access Key.

### Values to collect

| Application setting | Where to obtain it |
| --- | --- |
| `S3_BUCKET` | The exact bucket name you created |
| `S3_ENDPOINT` | Bucket S3 API endpoint's service origin |
| `S3_REGION` | Always `auto` for R2 |
| `AWS_ACCESS_KEY_ID` | **Access Key ID** on the R2 token creation result |
| `AWS_SECRET_ACCESS_KEY` | **Secret Access Key** on that same result |
| `AWS_SESSION_TOKEN` | Leave unset/empty for ordinary permanent R2 credentials; only temporary credentials need one |

The Account ID is not a secret signing key and is only needed as part of the
endpoint. No Zone ID, public domain, Cloudflare Global API Key, or additional
storage signing key is required.

Official token instructions:
https://developers.cloudflare.com/r2/api/tokens/.

## 3. Configure a host-run backend

Edit the existing `Backend/.env`; preserve your database and JWT settings:

```dotenv
STORAGE_DRIVER=s3
S3_BUCKET=ai-study-workspace-private
S3_REGION=auto
S3_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_R2_SECRET_ACCESS_KEY
```

Remove an old `AWS_SESSION_TOKEN` if you are not using temporary credentials.
Then run from `Backend/`:

```sh
npm run test:storage
npm run start:dev
```

The storage check builds the application, writes one randomly named object under
`connection-tests/`, reads and lists it, deletes it, and checks it is gone. It
does not use PostgreSQL or touch existing application objects. It performs real
billable API operations (normally tiny). A failed cleanup prints only that
temporary object's key so it can be deleted manually.

Missing credentials stop startup; the backend never silently falls back to local
storage when `STORAGE_DRIVER=s3` is selected.

## 4. Configure Docker Compose

From the project root, copy the template **only if `CI/.env` does not exist**:

```powershell
Copy-Item CI/.env.example CI/.env
```

Put the R2 settings above into `CI/.env`, as well as real `POSTGRES_PASSWORD` and
`JWT_SECRET` values. The template selects `STORAGE_DRIVER=s3`. These variables
are explicitly forwarded into the backend container; `Backend/.env` is not
copied into an image.

```sh
docker compose --env-file CI/.env up --build -d
docker compose --env-file CI/.env exec backend node scripts/storage-smoke.mjs
```

When rotating credentials, recreate the backend to load the new environment:

```sh
docker compose --env-file CI/.env up -d --force-recreate backend
```

Do not share `docker compose config` output: it expands secret values.
For deployments, prefer your platform's secret manager over environment files.

## 5. Verify application usage

After the storage check passes, uploads and generated content persisted by the
backend use the private bucket. Documents use `materials/<id>/...` keys and
guides use `study-guides/<id>/content.md`.

You can also run `npm run test:services` from `Backend/` against a configured
development database. It tests the full service lifecycle with its own temporary
account, storage objects and assessment data, then cleans them up. This is not a
test against production data.

Feature HTTP controllers expose upload and study-resource routes. Set `TIKA_URL`
to enable automatic extraction; R2 setup alone does not enable the worker.

## 6. Security, existing files and troubleshooting

- Keep development and production buckets/tokens separate.
- Server-to-server NestJS requests need no bucket browser CORS rule. Configure
  CORS only if direct browser uploads are implemented later.
- Moving to R2 **does not migrate local `.storage` files**. Copy existing objects
  with exactly their existing keys before switching a database with local files.
  Existing seed metadata does not have corresponding file objects.
- Revoking a compromised token and replacing its keys is safer than publishing a
  bucket to work around access errors.
- `403` / access denied: check token scope, read/write permission, bucket name,
  endpoint jurisdiction, source-IP restrictions, and token expiry.
- Signature errors: verify both S3 keys, `S3_REGION=auto`, an accurate system clock,
  and that `S3_ENDPOINT` has no bucket path, query string or public URL.
- DNS/network timeout: check the copied account endpoint and outbound HTTPS.
- Missing objects: confirm local files were migrated and that the database points
  at the same bucket. Do not treat access-denied errors as missing files.
- A smoke-test failure intentionally does not dump raw request/configuration
  details, to avoid leaking keys or signed URLs.

To use local storage again, set `STORAGE_DRIVER=local` and restart/recreate the
backend. R2 objects remain in R2 and are not copied back automatically.
