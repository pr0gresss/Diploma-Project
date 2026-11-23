# Authentication and errors

Public authentication routes use per-process, per-route IP limits: 5 registration
requests and 10 sign-in requests per minute. Excess requests return 429 with
`Retry-After`. Other API routes are not throttled by this guard. The backend does
not trust forwarded IP headers; clients behind the same reverse proxy share its
observed IP bucket. Multi-instance deployments need a shared limiter at their
trusted gateway or a shared throttler storage adapter.

[Documentation home](../README.md)

## Bearer authentication

`POST /auth/register` and `POST /auth/sign-in` are public. They return
`{user, accessToken, expiresIn, tokenType}`. Send the JWT on other controller routes:

```http
Authorization: Bearer eyJ...
```

In Swagger, use **Authorize** and paste only the access token; the UI adds the
Bearer prefix. Never paste `JWT_SECRET` or R2 credentials there.

The backend verifies signature, expiry, issuer and audience and checks that the
subject still maps to a user. Tokens are access-only, normally valid for 15
minutes. There is no refresh/logout HTTP endpoint. Sign in again after expiry.

| Configuration | Default / requirement |
| --- | --- |
| `JWT_SECRET` | Required, minimum 32 characters, server-only |
| `JWT_ISSUER` | `ai-study-workspace` |
| `JWT_AUDIENCE` | `ai-study-workspace-api` |
| `JWT_ACCESS_TTL` | `15m` |

Emails are case-insensitively unique. Registration passwords require 12–128
characters. Unknown accounts and wrong passwords return the same 401 error.
Use HTTPS outside localhost. Rate limiting and production abuse controls remain
pending; do not deploy public authentication endpoints without them.

## Error envelope

See [`http-error.schema.json`](../schemas/http-error.schema.json).

| Field | Required | Meaning |
| --- | --- | --- |
| `statusCode` | yes | HTTP response status |
| `message` | yes | Human-readable description; do not parse it |
| `errorCode` | no | Machine-readable domain/authentication error code |
| `error` | no | Nest HTTP error description |
| `details` | no | Sanitized validation metadata |

Missing authentication:

```json
{"message":"Unauthorized","statusCode":401,"errorCode":"missing_credentials"}
```

Invalid sign-in:

```json
{"statusCode":401,"message":"Invalid email or password","errorCode":"invalid_credentials"}
```

Invalid body, query or UUID:

```json
{"statusCode":400,"message":"Request validation failed","errorCode":"validation_error"}
```

Cross-user resource access:

```json
{"statusCode":404,"message":"Workspace not found","errorCode":"not_found"}
```

Unavailable object storage:

```json
{"statusCode":503,"message":"Service temporarily unavailable","errorCode":"storage_error"}
```

The global application-error filter maps domain errors without exposing causes,
database metadata or private storage keys. Unexpected failures keep Nest's
generic 500 response. Not all framework errors include `errorCode`; clients must
check HTTP status first. Authentication 401 responses include a Bearer
`WWW-Authenticate` challenge.

## Status mapping

| Status | Examples |
| --- | --- |
| 400 | Schema validation, invalid quiz/answer structure |
| 401 | Missing/invalid token or incorrect sign-in credentials |
| 403 | Forbidden domain operation |
| 404 | Missing resource, another user's resource, absent stored content |
| 409 | Duplicate account, invalid processing state, restricted assessment-history deletion |
| 413 | Upload/body too large |
| 415 | Unsupported upload type/signature |
| 500 | Unexpected server failure |
| 503 | Object storage unavailable |

OAuth generation can also return 503 with `errorCode: ai_unavailable` for
disabled/missing consent, exhausted plan allowance, an unavailable model or an
invalid/incomplete provider response. See [OpenAI OAuth setup](../../AI/OPENAI_OAUTH.md).

Processing-job claiming and completion/failure are internal methods, not
endpoints. Clients cannot mark a material READY or write grading results.
