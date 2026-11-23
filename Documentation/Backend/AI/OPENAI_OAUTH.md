# OpenAI OAuth quiz generation

> **Superseded:** generation now uses the six `LLM_*` variables and an
> OpenAI-compatible endpoint. See [current configuration and Codex gateway setup](LLM_CONFIGURATION.md).
> The direct-OAuth instructions below describe the legacy helper, not the active provider.

This implementation uses the official **Sign in with ChatGPT plan-usage OAuth
flow**, followed by the public **Responses API**, not `/v1/completions`, private
ChatGPT endpoints, extracted Codex login tokens, or an OpenAI API key.

Eligibility, consent and usage allowances are controlled by OpenAI. This is
not unlimited/free inference: requests use the authorized ChatGPT plan's limits.
If the account/app is not eligible or consent is denied, generation stays
unavailable. The application **never falls back to paid API-key billing**.

## Deployment scope and data

The credential session belongs to the operator of a **single-owner self-hosted
installation**. Only the application account configured by
`OPENAI_OAUTH_OWNER_USER_ID` may use it. Do not expose your personal subscription
session as a pooled AI service for unrelated users. Multi-user SaaS would need
separate eligible per-user OAuth registrations, secure credential isolation and
provider approval/requirements; that is not implemented here.

Source text is sent to OpenAI only when the authorized owner requests generation.
The request uses `store: false`, `stream: true`, no tools, no shell and no MCP.
The server validates all output before saving a quiz. Do not send study material
you are not entitled to disclose to the provider.

Current official references:

- [Sign-in and dynamic registration](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
- [Models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)
- [Account sessions and refresh](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions)
- [Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)
- [Self-hosted VMs](https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms)

## 1. Prepare the local application account

Apply migrations and start the backend. Register/sign in using the application's
own `/auth/register` or `/auth/sign-in` endpoints. Call authenticated `GET /me`
and copy your application user UUID. This is **not** your OpenAI user ID.

In `Backend/.env`, initially keep generation disabled:

```dotenv
OPENAI_OAUTH_ENABLED=false
OPENAI_OAUTH_FILE=.secrets/openai-oauth.json
OPENAI_OAUTH_OWNER_USER_ID=YOUR_APPLICATION_USER_UUID
```

Leave `OPENAI_API_KEY` and `CODEX_API_KEY` unset. They are not used by this service.
Do not paste anything from Codex's `auth.json`.

## 2. Continue with ChatGPT

From `Backend/`:

```sh
npm run ai:login
```

The command:

1. Starts a temporary callback listener bound only to `127.0.0.1`, on a free port.
2. Creates random state, nonce and a PKCE verifier/challenge.
3. Prints an official OpenAI authorization URL. Open it in a browser on the
   **same computer** and continue with ChatGPT.
4. On first registration, sends the app name `AI Study Workspace`, a stable host
   ID and `client_id=dynamic_agent_client`. The callback-issued client ID is used
   for token exchange and saved for later sign-ins.
5. Validates state, signed ID-token issuer/audience/expiry/nonce, and plan-use scopes.
6. Writes protected credentials atomically without printing the tokens.

No OpenAI client secret or API payment key is needed for the documented dynamic
registration flow. Grant plan usage only if you intend this application to use
your allowance. The browser must return to the printed exact
`http://127.0.0.1:<port>/auth/callback`; do not substitute `localhost`.

Existing saved registrations are reused, with identity checks; the tool does not
currently provide an account picker. It cannot silently switch an existing
registration to a different OpenAI account.

## 3. Choose an available model

```sh
npm run ai:models
```

This reads your authorized account's live model catalog and prints display names
and slugs, not credentials. Select a returned `slug` and set:

```dotenv
OPENAI_MODEL=YOUR_AVAILABLE_MODEL_SLUG
OPENAI_OAUTH_ENABLED=true
```

Restart the backend. No model name is hard-coded because availability depends on
your account. Do not enable generation before completing authorization.

## 4. Generate a quiz from READY material

In Swagger, authorize using your **application JWT**, not the OpenAI token:

```http
POST /materials/{materialId}/quizzes/generate
Authorization: Bearer <application-access-token>
Content-Type: application/json
```

```json
{
  "displayName": "Database practice",
  "questionCount": 6,
  "questionTypes": ["SINGLE_CHOICE", "SELECT", "MULTI_SELECT"]
}
```

The material must be owned, `READY`, and have available nonblank extracted text
of at most 120000 characters. The Tika extraction worker runs when `TIKA_URL` is configured,
so wait for extraction to reach `READY` before requesting quiz generation.

The HTTP request runs synchronously, with a 120-second AI deadline. Job status is
persisted under `GENERATE_QUIZ`; `GET /materials/{id}/jobs` can read it:

```text
Check owner, material readiness and source size
  → record RUNNING generation job
  → OAuth Responses request outside database transactions
  → wait for response.completed
  → validate JSON, requested counts/types and option correctness
  → save complete quiz + SUCCEEDED job in one transaction
```

On failure the job becomes `FAILED`, with a sanitized message and no partial
quiz. Only one generation per material may be active, and this process allows
one model completion at a time. There are no hidden retries/fallbacks.
Abandoned RUNNING jobs after process failure require operator recovery; automatic
recovery and a durable background AI worker remain future work.

## 5. Question types and grading

| `questionType` | Intended frontend control | Correct selections |
| --- | --- | --- |
| `SINGLE_CHOICE` | Radio buttons | Exactly one |
| `SELECT` | Dropdown | Exactly one |
| `MULTI_SELECT` | Checkboxes | One or more; exact set equality |

The Angular controls are not implemented by this backend change. The API returns
`questionType` so the frontend can render the appropriate control.

Submit:

```json
{
  "answers": [
    {
      "questionId": "11111111-1111-4111-8111-111111111111",
      "selectedOptionIds": [
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333"
      ]
    }
  ]
}
```

For radio/dropdown questions, the array must have one ID. For multi-select,
missing a correct option or selecting any incorrect option makes the entire
question incorrect. No partial credit. Array order does not matter; duplicates,
foreign options and repeated question answers are rejected.

Results include selected/correct ID and text arrays. Legacy singular result
fields remain for single-answer questions and are **null for multi-select**.
Legacy input `selectedOptionId` remains accepted instead of, not alongside,
`selectedOptionIds`. Existing questions default to `SINGLE_CHOICE`.

## 6. Credential security, refresh and disconnect

- `.secrets/` is Git-ignored and excluded from Docker build contexts.
- Files use owner-only POSIX permissions; on Windows ensure the directory ACL
  permits only your Windows account and required service account. POSIX modes
  alone do not enforce Windows ACL privacy.
- Access/ID/refresh tokens are not application JWTs and must never be sent to
  browser storage, Swagger, logs, support transcripts or source control.
- The session service refreshes near expiry and writes rotating tokens together.
  Refreshes are serialized in-process and protected by an exclusive file lock.
- If a crash leaves `<credential-file>.lock`, first stop all processes using the
  session; only then remove that stale lock and retry.
- Stop generation and disconnect the application in
  [ChatGPT Settings → Usage](https://chatgpt.com/settings/usage) to revoke plan
  access. Remove local credential files only after disconnecting. A dedicated
  application logout/account-switch interface is not implemented.
- Do not share/copy one credential file between independently running hosts.
  For an intentional VM deployment, follow OpenAI's documented secure-transfer
  procedure, retain that VM's host identity and let only that VM refresh its copy.

The default Docker Compose stack does not enable or mount OAuth credentials.
Use host-run generation first. Any self-hosted container deployment must pass
the owner/model/enabled settings explicitly and provide the private credential
file with write access for refresh, without baking it into an image.

## Troubleshooting and tests

- **503 `ai_unavailable`:** OAuth disabled, no model configured, missing/expired/
  revoked credentials, missing plan scopes, model unavailable, quota reached,
  invalid generated output or interrupted response stream.
- **403:** the application user is not the configured self-hosted session owner.
- **409:** material not READY, an active generation exists, or another completion
  is running on this instance.
- **400:** invalid options or a source larger than the supported bound.

Tests use mocked provider streams and temporary fake credential files, never
your real OpenAI session. `npm run test:http` additionally tests all three
question types and successful/failed generation publication against PostgreSQL,
replacing only the model boundary and using isolated local storage.
Live OAuth sign-in/inference requires your browser consent and has not been
performed automatically.
