# Endpoint reference

Generated from controller decorators. Do not edit manually; run `npm run docs:generate` from `Backend/`.

[Documentation home](../README.md) · [OpenAPI JSON](openapi.json)

| Method | Path | Operation | Authentication |
| --- | --- | --- | --- |
| GET | `/` | `getRootGreeting` | Bearer JWT |
| GET | `/me` | `getMyProfile` | Bearer JWT |
| POST | `/auth/register` | `registerAccount` | Public |
| POST | `/auth/sign-in` | `signIn` | Public |
| GET | `/workspaces` | `listWorkspaces` | Bearer JWT |
| POST | `/workspaces` | `createWorkspace` | Bearer JWT |
| GET | `/workspaces/{workspaceId}` | `getWorkspace` | Bearer JWT |
| PATCH | `/workspaces/{workspaceId}` | `renameWorkspace` | Bearer JWT |
| DELETE | `/workspaces/{workspaceId}` | `deleteWorkspace` | Bearer JWT |
| GET | `/materials/{materialId}/jobs` | `listMaterialJobs` | Bearer JWT |
| GET | `/workspaces/{workspaceId}/materials` | `listMaterials` | Bearer JWT |
| POST | `/workspaces/{workspaceId}/materials` | `uploadMaterial` | Bearer JWT |
| GET | `/materials/{materialId}` | `getMaterial` | Bearer JWT |
| PATCH | `/materials/{materialId}` | `renameMaterial` | Bearer JWT |
| DELETE | `/materials/{materialId}` | `deleteMaterial` | Bearer JWT |
| GET | `/materials/{materialId}/text` | `getMaterialText` | Bearer JWT |
| POST | `/materials/{materialId}/extraction/retry` | `retryExtraction` | Bearer JWT |
| GET | `/materials/{materialId}/study-guides` | `listStudyGuides` | Bearer JWT |
| POST | `/materials/{materialId}/study-guides` | `createStudyGuide` | Bearer JWT |
| GET | `/study-guides/{guideId}` | `getStudyGuide` | Bearer JWT |
| PATCH | `/study-guides/{guideId}` | `renameStudyGuide` | Bearer JWT |
| DELETE | `/study-guides/{guideId}` | `deleteStudyGuide` | Bearer JWT |
| POST | `/materials/{materialId}/quizzes/generate` | `generateQuiz` | Bearer JWT |
| GET | `/materials/{materialId}/quizzes` | `listQuizzes` | Bearer JWT |
| POST | `/materials/{materialId}/quizzes` | `createQuiz` | Bearer JWT |
| GET | `/quizzes/{quizId}` | `getQuizForTaking` | Bearer JWT |
| PATCH | `/quizzes/{quizId}` | `renameQuiz` | Bearer JWT |
| DELETE | `/quizzes/{quizId}` | `deleteQuiz` | Bearer JWT |
| GET | `/me/attempts` | `listMyAttempts` | Bearer JWT |
| GET | `/quizzes/{quizId}/attempts` | `listQuizAttempts` | Bearer JWT |
| POST | `/quizzes/{quizId}/attempts` | `submitQuizAttempt` | Bearer JWT |
| GET | `/attempts/{attemptId}` | `getAttemptResult` | Bearer JWT |
| GET | `/me/progress` | `getMyProgress` | Bearer JWT |
| GET | `/me/progress/overview` | `getMyProgressOverview` | Bearer JWT |

## GET /

**Read the authenticated API greeting**

Returns the existing bootstrap greeting. Requires a valid JWT whose subject resolves to an existing user. There are no path/query parameters or request body. This is not a database health check. The Express adapter sends the string as text/html; it is not a JSON string or object.

Operation ID: `getRootGreeting`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X GET "$BASE_URL/" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 200 — Authenticated request succeeded.

Content-Type: `text/html`.

```text
Hello World!
```

#### 401 — Missing, malformed, expired or otherwise invalid credentials, or an account that no longer exists.

Content-Type: `application/json`.

```json
{
  "message": "Unauthorized",
  "statusCode": 401,
  "errorCode": "missing_credentials"
}
```

#### 500 — Unexpected server failure, for example the user lookup database is unavailable.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## GET /me

**Read the current account profile**

Read the current account profile

Operation ID: `getMyProfile`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X GET "$BASE_URL/me" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 200 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "email": "student@example.com",
  "createdAt": "2026-11-01T10:00:00.000Z",
  "updatedAt": "2026-11-01T10:00:00.000Z"
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## POST /auth/register

**Register an account and receive an access token**

Public operation. Emails are unique case-insensitively. Passwords require 12–128 characters. No refresh token is issued.

Operation ID: `registerAccount`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| — | None | — | — |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" -d '{"email":"student@example.com","password":"StrongStudyPassword!2026"}'
```

JSON request body:

```json
{
  "email": "student@example.com",
  "password": "StrongStudyPassword!2026"
}
```

### Responses

#### 201 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "email": "student@example.com",
    "createdAt": "2026-11-01T10:00:00.000Z",
    "updatedAt": "2026-11-01T10:00:00.000Z"
  },
  "accessToken": "documentation-example-not-a-valid-jwt",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Invalid email or password",
  "errorCode": "invalid_credentials"
}
```

#### 409 — Operation conflicts with resource state, uniqueness or assessment history.

Content-Type: `application/json`.

```json
{
  "statusCode": 409,
  "message": "Operation conflicts with resource state",
  "errorCode": "conflict"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## POST /auth/sign-in

**Sign in using email and password**

Public operation. Returns a short-lived bearer access token. Sign in again after expiry; refresh/logout endpoints are not provided.

Operation ID: `signIn`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| — | None | — | — |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X POST "$BASE_URL/auth/sign-in" -H "Content-Type: application/json" -d '{"email":"alice@example.com","password":"StudyDemo!2026"}'
```

JSON request body:

```json
{
  "email": "alice@example.com",
  "password": "StudyDemo!2026"
}
```

### Responses

#### 200 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "email": "student@example.com",
    "createdAt": "2026-11-01T10:00:00.000Z",
    "updatedAt": "2026-11-01T10:00:00.000Z"
  },
  "accessToken": "documentation-example-not-a-valid-jwt",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Invalid email or password",
  "errorCode": "invalid_credentials"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## GET /workspaces

**List and search owned workspaces**

List and search owned workspaces

Operation ID: `listWorkspaces`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| query | `limit` | no | integer |
| query | `offset` | no | integer |
| query | `search` | no | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X GET "$BASE_URL/workspaces" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 200 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "items": [
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "name": "Database systems",
      "materialCount": 1,
      "createdAt": "2026-11-01T10:00:00.000Z",
      "updatedAt": "2026-11-01T10:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## POST /workspaces

**Create a workspace**

Create a workspace

Operation ID: `createWorkspace`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X POST "$BASE_URL/workspaces" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Database systems"}'
```

JSON request body:

```json
{
  "name": "Database systems"
}
```

### Responses

#### 201 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "id": "22222222-2222-4222-8222-222222222222",
  "name": "Database systems",
  "materialCount": 1,
  "createdAt": "2026-11-01T10:00:00.000Z",
  "updatedAt": "2026-11-01T10:00:00.000Z"
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## GET /workspaces/{workspaceId}

**Read an owned workspace**

Read an owned workspace

Operation ID: `getWorkspace`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `workspaceId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X GET "$BASE_URL/workspaces/11111111-1111-4111-8111-111111111111" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 200 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "id": "22222222-2222-4222-8222-222222222222",
  "name": "Database systems",
  "materialCount": 1,
  "createdAt": "2026-11-01T10:00:00.000Z",
  "updatedAt": "2026-11-01T10:00:00.000Z"
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## PATCH /workspaces/{workspaceId}

**Rename an owned workspace**

Rename an owned workspace

Operation ID: `renameWorkspace`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `workspaceId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X PATCH "$BASE_URL/workspaces/11111111-1111-4111-8111-111111111111" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Advanced databases"}'
```

JSON request body:

```json
{
  "name": "Advanced databases"
}
```

### Responses

#### 200 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "id": "22222222-2222-4222-8222-222222222222",
  "name": "Database systems",
  "materialCount": 1,
  "createdAt": "2026-11-01T10:00:00.000Z",
  "updatedAt": "2026-11-01T10:00:00.000Z"
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## DELETE /workspaces/{workspaceId}

**Delete a workspace without assessment history**

Deletes eligible database resources and then attempts private-object cleanup. Assessment history prevents deletion.

Operation ID: `deleteWorkspace`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `workspaceId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X DELETE "$BASE_URL/workspaces/11111111-1111-4111-8111-111111111111" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 204 — Deleted successfully; no response body.

No response body.

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 409 — Operation conflicts with resource state, uniqueness or assessment history.

Content-Type: `application/json`.

```json
{
  "statusCode": 409,
  "message": "Operation conflicts with resource state",
  "errorCode": "conflict"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## GET /materials/{materialId}/jobs

**Read processing jobs for an owned material**

Read processing jobs for an owned material

Operation ID: `listMaterialJobs`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `materialId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X GET "$BASE_URL/materials/11111111-1111-4111-8111-111111111111/jobs" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 200 — Operation succeeded.

Content-Type: `application/json`.

```json
[
  {
    "id": "11111111-1111-4111-8111-111111111111",
    "materialId": "33333333-3333-4333-8333-333333333333",
    "jobType": "EXTRACT_TEXT",
    "status": "QUEUED",
    "errorMessage": null,
    "createdAt": "2026-11-01T10:00:00.000Z",
    "startedAt": null,
    "finishedAt": null
  }
]
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## GET /workspaces/{workspaceId}/materials

**List materials in an owned workspace**

List materials in an owned workspace

Operation ID: `listMaterials`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `workspaceId` | yes | string |
| query | `limit` | no | integer |
| query | `offset` | no | integer |
| query | `search` | no | string |
| query | `status` | no | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X GET "$BASE_URL/workspaces/11111111-1111-4111-8111-111111111111/materials" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 200 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "items": [
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "workspaceId": "22222222-2222-4222-8222-222222222222",
      "displayName": "Lecture notes",
      "originalFilename": "lecture.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 248576,
      "processingStatus": "UPLOADED",
      "jobCount": 1,
      "guideCount": 0,
      "quizCount": 0,
      "createdAt": "2026-11-01T10:00:00.000Z",
      "updatedAt": "2026-11-01T10:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## POST /workspaces/{workspaceId}/materials

**Upload a PDF or DOCX and enqueue extraction**

Stores the original file privately and queues extraction. When TIKA_URL is configured, the background worker extracts text and marks the material READY, or FAILED if extraction fails.

Operation ID: `uploadMaterial`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `workspaceId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X POST "$BASE_URL/workspaces/11111111-1111-4111-8111-111111111111/materials" -H "Authorization: Bearer $TOKEN" -F "file=@lecture.pdf;type=application/pdf" -F "displayName=Lecture notes"
```

Multipart body: required `file` (PDF/DOCX, maximum 10 MiB), optional `displayName`.

### Responses

#### 201 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "id": "33333333-3333-4333-8333-333333333333",
  "workspaceId": "22222222-2222-4222-8222-222222222222",
  "displayName": "Lecture notes",
  "originalFilename": "lecture.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 248576,
  "processingStatus": "UPLOADED",
  "jobCount": 1,
  "guideCount": 0,
  "quizCount": 0,
  "createdAt": "2026-11-01T10:00:00.000Z",
  "updatedAt": "2026-11-01T10:00:00.000Z",
  "processingJobs": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "materialId": "33333333-3333-4333-8333-333333333333",
      "jobType": "EXTRACT_TEXT",
      "status": "QUEUED",
      "errorMessage": null,
      "createdAt": "2026-11-01T10:00:00.000Z",
      "startedAt": null,
      "finishedAt": null
    }
  ]
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 413 — Uploaded document exceeds the size limit.

Content-Type: `application/json`.

```json
{
  "statusCode": 413,
  "message": "The file exceeds the 10 MiB limit",
  "errorCode": "payload_too_large"
}
```

#### 415 — Unsupported document type.

Content-Type: `application/json`.

```json
{
  "statusCode": 415,
  "message": "Only PDF and DOCX documents are supported",
  "errorCode": "unsupported_media_type"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

#### 503 — Private object storage or the AI provider is unavailable or not configured.

Content-Type: `application/json`.

```json
{
  "statusCode": 503,
  "message": "Service temporarily unavailable",
  "errorCode": "storage_error"
}
```

## GET /materials/{materialId}

**Read material metadata and processing jobs**

Read material metadata and processing jobs

Operation ID: `getMaterial`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `materialId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X GET "$BASE_URL/materials/11111111-1111-4111-8111-111111111111" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 200 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "id": "33333333-3333-4333-8333-333333333333",
  "workspaceId": "22222222-2222-4222-8222-222222222222",
  "displayName": "Lecture notes",
  "originalFilename": "lecture.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 248576,
  "processingStatus": "UPLOADED",
  "jobCount": 1,
  "guideCount": 0,
  "quizCount": 0,
  "createdAt": "2026-11-01T10:00:00.000Z",
  "updatedAt": "2026-11-01T10:00:00.000Z",
  "processingJobs": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "materialId": "33333333-3333-4333-8333-333333333333",
      "jobType": "EXTRACT_TEXT",
      "status": "QUEUED",
      "errorMessage": null,
      "createdAt": "2026-11-01T10:00:00.000Z",
      "startedAt": null,
      "finishedAt": null
    }
  ]
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## PATCH /materials/{materialId}

**Rename a material**

Rename a material

Operation ID: `renameMaterial`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `materialId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X PATCH "$BASE_URL/materials/11111111-1111-4111-8111-111111111111" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"displayName":"Lecture notes"}'
```

JSON request body:

```json
{
  "displayName": "Lecture notes"
}
```

### Responses

#### 200 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "id": "33333333-3333-4333-8333-333333333333",
  "workspaceId": "22222222-2222-4222-8222-222222222222",
  "displayName": "Lecture notes",
  "originalFilename": "lecture.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 248576,
  "processingStatus": "UPLOADED",
  "jobCount": 1,
  "guideCount": 0,
  "quizCount": 0,
  "createdAt": "2026-11-01T10:00:00.000Z",
  "updatedAt": "2026-11-01T10:00:00.000Z"
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## DELETE /materials/{materialId}

**Delete a material without assessment history**

Delete a material without assessment history

Operation ID: `deleteMaterial`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `materialId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X DELETE "$BASE_URL/materials/11111111-1111-4111-8111-111111111111" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 204 — Deleted successfully; no response body.

No response body.

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 409 — Operation conflicts with resource state, uniqueness or assessment history.

Content-Type: `application/json`.

```json
{
  "statusCode": 409,
  "message": "Operation conflicts with resource state",
  "errorCode": "conflict"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## GET /materials/{materialId}/text

**Read extracted text**

Returns text only when extraction output is available in private storage.

Operation ID: `getMaterialText`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `materialId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X GET "$BASE_URL/materials/11111111-1111-4111-8111-111111111111/text" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 200 — Operation succeeded.

Extracted UTF-8 text.

Content-Type: `text/plain`.

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

#### 503 — Private object storage or the AI provider is unavailable or not configured.

Content-Type: `application/json`.

```json
{
  "statusCode": 503,
  "message": "Service temporarily unavailable",
  "errorCode": "storage_error"
}
```

## POST /materials/{materialId}/extraction/retry

**Queue a new extraction attempt**

Only uploaded or failed materials can be retried. An existing queued/running extraction conflicts.

Operation ID: `retryExtraction`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `materialId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X POST "$BASE_URL/materials/11111111-1111-4111-8111-111111111111/extraction/retry" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 201 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "materialId": "33333333-3333-4333-8333-333333333333",
  "jobType": "EXTRACT_TEXT",
  "status": "QUEUED",
  "errorMessage": null,
  "createdAt": "2026-11-01T10:00:00.000Z",
  "startedAt": null,
  "finishedAt": null
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 409 — Operation conflicts with resource state, uniqueness or assessment history.

Content-Type: `application/json`.

```json
{
  "statusCode": 409,
  "message": "Operation conflicts with resource state",
  "errorCode": "conflict"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## GET /materials/{materialId}/study-guides

**List study guides for an owned material**

List study guides for an owned material

Operation ID: `listStudyGuides`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `materialId` | yes | string |
| query | `limit` | no | integer |
| query | `offset` | no | integer |
| query | `search` | no | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X GET "$BASE_URL/materials/11111111-1111-4111-8111-111111111111/study-guides" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 200 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "items": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "materialId": "33333333-3333-4333-8333-333333333333",
      "displayName": "Transactions study guide",
      "createdAt": "2026-11-01T10:00:00.000Z",
      "updatedAt": "2026-11-01T10:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## POST /materials/{materialId}/study-guides

**Store a Markdown guide for a ready material**

Persists supplied Markdown, maximum 5 MiB. This does not call an AI provider. Material must be READY.

Operation ID: `createStudyGuide`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `materialId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X POST "$BASE_URL/materials/11111111-1111-4111-8111-111111111111/study-guides" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"displayName":"Transactions","content":"# Transactions\n\nTransactions are atomic."}'
```

JSON request body:

```json
{
  "displayName": "Transactions",
  "content": "# Transactions\n\nTransactions are atomic."
}
```

### Responses

#### 201 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "materialId": "33333333-3333-4333-8333-333333333333",
  "displayName": "Transactions study guide",
  "createdAt": "2026-11-01T10:00:00.000Z",
  "updatedAt": "2026-11-01T10:00:00.000Z"
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 409 — Operation conflicts with resource state, uniqueness or assessment history.

Content-Type: `application/json`.

```json
{
  "statusCode": 409,
  "message": "Operation conflicts with resource state",
  "errorCode": "conflict"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

#### 503 — Private object storage or the AI provider is unavailable or not configured.

Content-Type: `application/json`.

```json
{
  "statusCode": 503,
  "message": "Service temporarily unavailable",
  "errorCode": "storage_error"
}
```

## GET /study-guides/{guideId}

**Read a study guide including its Markdown content**

Read a study guide including its Markdown content

Operation ID: `getStudyGuide`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `guideId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X GET "$BASE_URL/study-guides/11111111-1111-4111-8111-111111111111" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 200 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "materialId": "33333333-3333-4333-8333-333333333333",
  "displayName": "Transactions study guide",
  "createdAt": "2026-11-01T10:00:00.000Z",
  "updatedAt": "2026-11-01T10:00:00.000Z",
  "content": "# Transactions\n\nTransactions are atomic."
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

#### 503 — Private object storage or the AI provider is unavailable or not configured.

Content-Type: `application/json`.

```json
{
  "statusCode": 503,
  "message": "Service temporarily unavailable",
  "errorCode": "storage_error"
}
```

## PATCH /study-guides/{guideId}

**Rename a study guide**

Rename a study guide

Operation ID: `renameStudyGuide`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `guideId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X PATCH "$BASE_URL/study-guides/11111111-1111-4111-8111-111111111111" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"displayName":"Updated study guide"}'
```

JSON request body:

```json
{
  "displayName": "Updated study guide"
}
```

### Responses

#### 200 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "materialId": "33333333-3333-4333-8333-333333333333",
  "displayName": "Transactions study guide",
  "createdAt": "2026-11-01T10:00:00.000Z",
  "updatedAt": "2026-11-01T10:00:00.000Z"
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## DELETE /study-guides/{guideId}

**Delete a guide and clean up its private object**

Delete a guide and clean up its private object

Operation ID: `deleteStudyGuide`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `guideId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X DELETE "$BASE_URL/study-guides/11111111-1111-4111-8111-111111111111" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 204 — Deleted successfully; no response body.

No response body.

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## POST /materials/{materialId}/quizzes/generate

**Generate a typed quiz using the configured OpenAI-compatible provider**

Requires owned READY extracted text and configured LLM_MODEL/LLM_API_KEY. Uses the LLM_BASE_URL OpenAI-compatible Chat Completions API with JSON mode and local schema validation. LLM_TIMEOUT_MS, LLM_MAX_CONTEXT_CHARS (including instructions/schema), and LLM_MAX_OUTPUT_TOKENS bound requests. Runs synchronously; poll material jobs for status. No automatic retries, provider fallback or partial publication.

Operation ID: `generateQuiz`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `materialId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X POST "$BASE_URL/materials/11111111-1111-4111-8111-111111111111/quizzes/generate" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"questionCount":6,"questionTypes":["SINGLE_CHOICE","SELECT","MULTI_SELECT"]}'
```

JSON request body:

```json
{
  "questionCount": 6,
  "questionTypes": [
    "SINGLE_CHOICE",
    "SELECT",
    "MULTI_SELECT"
  ]
}
```

### Responses

#### 201 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "id": "44444444-4444-4444-8444-444444444444",
  "materialId": "33333333-3333-4333-8333-333333333333",
  "displayName": "Transactions quiz",
  "questionCount": 1,
  "createdAt": "2026-11-01T10:00:00.000Z",
  "updatedAt": "2026-11-01T10:00:00.000Z"
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 403 — Operation is not allowed for this account.

Content-Type: `application/json`.

```json
{
  "statusCode": 403,
  "message": "Operation is not allowed for this account",
  "errorCode": "forbidden"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 409 — Operation conflicts with resource state, uniqueness or assessment history.

Content-Type: `application/json`.

```json
{
  "statusCode": 409,
  "message": "Operation conflicts with resource state",
  "errorCode": "conflict"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

#### 503 — Private object storage or the AI provider is unavailable or not configured.

Content-Type: `application/json`.

```json
{
  "statusCode": 503,
  "message": "Service temporarily unavailable",
  "errorCode": "storage_error"
}
```

## GET /materials/{materialId}/quizzes

**List quizzes for an owned material**

List quizzes for an owned material

Operation ID: `listQuizzes`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `materialId` | yes | string |
| query | `limit` | no | integer |
| query | `offset` | no | integer |
| query | `search` | no | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X GET "$BASE_URL/materials/11111111-1111-4111-8111-111111111111/quizzes" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 200 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "items": [
    {
      "id": "44444444-4444-4444-8444-444444444444",
      "materialId": "33333333-3333-4333-8333-333333333333",
      "displayName": "Transactions quiz",
      "questionCount": 1,
      "createdAt": "2026-11-01T10:00:00.000Z",
      "updatedAt": "2026-11-01T10:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## POST /materials/{materialId}/quizzes

**Create a complete quiz from supplied questions**

Material must be READY. Requires 1–100 questions with 2–10 options. SINGLE_CHOICE (radio) and SELECT (dropdown) need exactly one correct option. MULTI_SELECT (checkboxes) needs at least one correct option and uses exact-set grading. Omitted questionType defaults to SINGLE_CHOICE.

Operation ID: `createQuiz`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `materialId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X POST "$BASE_URL/materials/11111111-1111-4111-8111-111111111111/quizzes" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"displayName":"Transactions quiz","questions":[{"prompt":"Are transactions atomic?","explanation":"All changes commit together or roll back.","options":[{"text":"Yes","isCorrect":true},{"text":"No","isCorrect":false}]}]}'
```

JSON request body:

```json
{
  "displayName": "Transactions quiz",
  "questions": [
    {
      "prompt": "Are transactions atomic?",
      "explanation": "All changes commit together or roll back.",
      "options": [
        {
          "text": "Yes",
          "isCorrect": true
        },
        {
          "text": "No",
          "isCorrect": false
        }
      ]
    }
  ]
}
```

### Responses

#### 201 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "id": "44444444-4444-4444-8444-444444444444",
  "materialId": "33333333-3333-4333-8333-333333333333",
  "displayName": "Transactions quiz",
  "questionCount": 1,
  "createdAt": "2026-11-01T10:00:00.000Z",
  "updatedAt": "2026-11-01T10:00:00.000Z"
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 409 — Operation conflicts with resource state, uniqueness or assessment history.

Content-Type: `application/json`.

```json
{
  "statusCode": 409,
  "message": "Operation conflicts with resource state",
  "errorCode": "conflict"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## GET /quizzes/{quizId}

**Read quiz questions without correct answers**

Correctness flags and explanations are omitted until an attempt has been submitted.

Operation ID: `getQuizForTaking`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `quizId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X GET "$BASE_URL/quizzes/11111111-1111-4111-8111-111111111111" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 200 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "id": "44444444-4444-4444-8444-444444444444",
  "materialId": "33333333-3333-4333-8333-333333333333",
  "displayName": "Transactions quiz",
  "materialDisplayName": "Lecture notes",
  "workspaceId": "22222222-2222-4222-8222-222222222222",
  "questions": [
    {
      "questionType": "SINGLE_CHOICE",
      "id": "55555555-5555-4555-8555-555555555555",
      "position": 1,
      "prompt": "Are transactions atomic?",
      "options": [
        {
          "id": "66666666-6666-4666-8666-666666666666",
          "position": 1,
          "text": "Yes"
        },
        {
          "id": "77777777-7777-4777-8777-777777777777",
          "position": 2,
          "text": "No"
        }
      ]
    }
  ]
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## PATCH /quizzes/{quizId}

**Rename quiz metadata without modifying questions**

Rename quiz metadata without modifying questions

Operation ID: `renameQuiz`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `quizId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X PATCH "$BASE_URL/quizzes/11111111-1111-4111-8111-111111111111" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"displayName":"Practice quiz"}'
```

JSON request body:

```json
{
  "displayName": "Practice quiz"
}
```

### Responses

#### 200 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "id": "44444444-4444-4444-8444-444444444444",
  "materialId": "33333333-3333-4333-8333-333333333333",
  "displayName": "Transactions quiz",
  "questionCount": 1,
  "createdAt": "2026-11-01T10:00:00.000Z",
  "updatedAt": "2026-11-01T10:00:00.000Z"
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## DELETE /quizzes/{quizId}

**Delete a quiz without submitted attempts**

Delete a quiz without submitted attempts

Operation ID: `deleteQuiz`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `quizId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X DELETE "$BASE_URL/quizzes/11111111-1111-4111-8111-111111111111" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 204 — Deleted successfully; no response body.

No response body.

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 409 — Operation conflicts with resource state, uniqueness or assessment history.

Content-Type: `application/json`.

```json
{
  "statusCode": 409,
  "message": "Operation conflicts with resource state",
  "errorCode": "conflict"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## GET /me/attempts

**List the current user’s attempt history**

List the current user’s attempt history

Operation ID: `listMyAttempts`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| query | `limit` | no | integer |
| query | `offset` | no | integer |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X GET "$BASE_URL/me/attempts" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 200 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "items": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "quizId": "44444444-4444-4444-8444-444444444444",
      "quizDisplayName": "Transactions quiz",
      "materialId": "33333333-3333-4333-8333-333333333333",
      "workspaceId": "22222222-2222-4222-8222-222222222222",
      "submittedAt": "2026-11-01T10:00:00.000Z",
      "totalQuestions": 1,
      "correctAnswers": 1,
      "scorePercent": 100
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## GET /quizzes/{quizId}/attempts

**List personal attempts for an owned quiz**

List personal attempts for an owned quiz

Operation ID: `listQuizAttempts`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `quizId` | yes | string |
| query | `limit` | no | integer |
| query | `offset` | no | integer |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X GET "$BASE_URL/quizzes/11111111-1111-4111-8111-111111111111/attempts" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 200 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "items": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "quizId": "44444444-4444-4444-8444-444444444444",
      "quizDisplayName": "Transactions quiz",
      "materialId": "33333333-3333-4333-8333-333333333333",
      "workspaceId": "22222222-2222-4222-8222-222222222222",
      "submittedAt": "2026-11-01T10:00:00.000Z",
      "totalQuestions": 1,
      "correctAnswers": 1,
      "scorePercent": 100
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## POST /quizzes/{quizId}/attempts

**Submit answers and receive a server-graded result**

Submit selectedOptionIds for every question: one ID for SINGLE_CHOICE/SELECT, one or more for MULTI_SELECT. Multi-select is correct only when the complete correct set is selected with no extras; order is irrelevant. Legacy selectedOptionId is accepted instead of the array, not alongside it. User ID and score are never accepted. Every submission creates a new attempt; retries are not idempotent.

Operation ID: `submitQuizAttempt`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `quizId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X POST "$BASE_URL/quizzes/11111111-1111-4111-8111-111111111111/attempts" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"answers":[{"questionId":"11111111-1111-4111-8111-111111111111","selectedOptionId":"22222222-2222-4222-8222-222222222222"}]}'
```

JSON request body:

```json
{
  "answers": [
    {
      "questionId": "11111111-1111-4111-8111-111111111111",
      "selectedOptionId": "22222222-2222-4222-8222-222222222222"
    }
  ]
}
```

### Responses

#### 201 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "quizId": "44444444-4444-4444-8444-444444444444",
  "quizDisplayName": "Transactions quiz",
  "materialId": "33333333-3333-4333-8333-333333333333",
  "workspaceId": "22222222-2222-4222-8222-222222222222",
  "submittedAt": "2026-11-01T10:00:00.000Z",
  "totalQuestions": 1,
  "correctAnswers": 1,
  "scorePercent": 100,
  "answers": [
    {
      "questionId": "55555555-5555-4555-8555-555555555555",
      "questionType": "SINGLE_CHOICE",
      "selectedOptionIds": [
        "66666666-6666-4666-8666-666666666666"
      ],
      "selectedOptionTexts": [
        "Yes"
      ],
      "correctOptionIds": [
        "66666666-6666-4666-8666-666666666666"
      ],
      "correctOptionTexts": [
        "Yes"
      ],
      "questionPosition": 1,
      "prompt": "Are transactions atomic?",
      "selectedOptionId": "66666666-6666-4666-8666-666666666666",
      "selectedOptionText": "Yes",
      "correctOptionId": "66666666-6666-4666-8666-666666666666",
      "correctOptionText": "Yes",
      "isCorrect": true,
      "explanation": "All changes commit together or roll back."
    }
  ]
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 409 — Operation conflicts with resource state, uniqueness or assessment history.

Content-Type: `application/json`.

```json
{
  "statusCode": 409,
  "message": "Operation conflicts with resource state",
  "errorCode": "conflict"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## GET /attempts/{attemptId}

**Read a personal result including correct answers**

Read a personal result including correct answers

Operation ID: `getAttemptResult`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| path | `attemptId` | yes | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X GET "$BASE_URL/attempts/11111111-1111-4111-8111-111111111111" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 200 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "quizId": "44444444-4444-4444-8444-444444444444",
  "quizDisplayName": "Transactions quiz",
  "materialId": "33333333-3333-4333-8333-333333333333",
  "workspaceId": "22222222-2222-4222-8222-222222222222",
  "submittedAt": "2026-11-01T10:00:00.000Z",
  "totalQuestions": 1,
  "correctAnswers": 1,
  "scorePercent": 100,
  "answers": [
    {
      "questionId": "55555555-5555-4555-8555-555555555555",
      "questionType": "SINGLE_CHOICE",
      "selectedOptionIds": [
        "66666666-6666-4666-8666-666666666666"
      ],
      "selectedOptionTexts": [
        "Yes"
      ],
      "correctOptionIds": [
        "66666666-6666-4666-8666-666666666666"
      ],
      "correctOptionTexts": [
        "Yes"
      ],
      "questionPosition": 1,
      "prompt": "Are transactions atomic?",
      "selectedOptionId": "66666666-6666-4666-8666-666666666666",
      "selectedOptionText": "Yes",
      "correctOptionId": "66666666-6666-4666-8666-666666666666",
      "correctOptionText": "Yes",
      "isCorrect": true,
      "explanation": "All changes commit together or roll back."
    }
  ]
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 404 — Resource not found, including resources owned by another user.

Content-Type: `application/json`.

```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "errorCode": "not_found"
}
```

#### 409 — Operation conflicts with resource state, uniqueness or assessment history.

Content-Type: `application/json`.

```json
{
  "statusCode": 409,
  "message": "Operation conflicts with resource state",
  "errorCode": "conflict"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## GET /me/progress

**Read personal quiz progress and overall totals**

Rows represent attempted quizzes. Search filters rows by quiz, material or workspace name. Overview totals remain unfiltered across all personal attempts.

Operation ID: `getMyProgress`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| query | `limit` | no | integer |
| query | `offset` | no | integer |
| query | `search` | no | string |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X GET "$BASE_URL/me/progress" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 200 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "items": [
    {
      "quizId": "44444444-4444-4444-8444-444444444444",
      "quizDisplayName": "Transactions quiz",
      "materialId": "33333333-3333-4333-8333-333333333333",
      "materialDisplayName": "Lecture notes",
      "workspaceId": "22222222-2222-4222-8222-222222222222",
      "workspaceName": "Database systems",
      "completedAttempts": 1,
      "averageScorePercent": 100,
      "bestScorePercent": 100,
      "latestScorePercent": 100,
      "lastCompletedAt": "2026-11-01T10:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "overview": {
    "totalAttempts": 1,
    "completedQuizzes": 1,
    "workspacesStudied": 1,
    "averageScorePercent": 100,
    "bestScorePercent": 100,
    "lastCompletedAt": "2026-11-01T10:00:00.000Z"
  }
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## GET /me/progress/overview

**Read overall personal study totals**

An account without attempts returns zero totals and null lastCompletedAt.

Operation ID: `getMyProgressOverview`.

### Parameters

| Location | Name | Required | Type |
| --- | --- | --- | --- |
| header | `Authorization` | yes | `Bearer <accessToken>` |

### Sample request

Use `BASE_URL=http://localhost:3000` and a real access token. UUIDs below are illustrative; replace them with IDs returned by the API.

```sh
curl -i -X GET "$BASE_URL/me/progress/overview" -H "Authorization: Bearer $TOKEN"
```

### Responses

#### 200 — Operation succeeded.

Content-Type: `application/json`.

```json
{
  "totalAttempts": 1,
  "completedQuizzes": 1,
  "workspacesStudied": 1,
  "averageScorePercent": 100,
  "bestScorePercent": 100,
  "lastCompletedAt": "2026-11-01T10:00:00.000Z"
}
```

#### 400 — Invalid request parameters or body.

Content-Type: `application/json`.

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errorCode": "validation_error"
}
```

#### 401 — Missing or invalid credentials.

Content-Type: `application/json`.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errorCode": "missing_credentials"
}
```

#### 500 — Unexpected server failure.

Content-Type: `application/json`.

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

