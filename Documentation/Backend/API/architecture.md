# Architecture overview

[Documentation home](README.md) · [Database design](../../Database/DATABASE.md)

## System context

```mermaid
flowchart LR
    developer["Developer / API client"] --> swagger["Swagger UI /docs"]
    developer --> api["NestJS HTTP API"]
    browser["Angular browser app"] --> proxy["Nginx /api reverse proxy"]
    proxy --> api
    api --> auth["Global JWT authentication guard"]
    auth --> users["UsersRepository"]
    users --> postgres[("PostgreSQL")]
    api --> root["AppController GET /"]
    api --> controllers["Auth / user / workspace / material / guide / quiz / attempt / progress controllers"]
    controllers --> services["Domain services"]
    services --> postgres
    services --> storage["ObjectStorage adapter"]
    storage --> disk[("Private local disk or Cloudflare R2")]
    services --> ai["Owner-scoped OAuth CompletionsService"]
    ai --> responses["OpenAI public Responses API"]
    worker["Extraction worker (TIKA_URL enabled)"] --> tika["Apache Tika"]
    worker --> services
```

Arrows show implemented relationships. The proxy exists, but Angular application
API integration is pending.

## Current authenticated request flow

```mermaid
sequenceDiagram
    participant C as Client
    participant G as Authentication guard
    participant U as UsersRepository
    participant DB as PostgreSQL
    participant A as AppController
    C->>G: GET / with Authorization: Bearer token
    G->>G: Verify signature, expiry, issuer and audience
    alt Missing or invalid token
        G-->>C: 401 + WWW-Authenticate
    else Verified token
        G->>U: findById(token.sub)
        U->>DB: Load public user fields
        DB-->>U: User or no row
        alt User exists
            G->>A: Invoke getHello()
            A-->>C: 200 text/html: Hello World!
        else User no longer exists
            G-->>C: 401
        end
    end
```

## Module/resource inventory

| Module | Implemented responsibility | HTTP status |
| --- | --- | --- |
| App | Starter authenticated greeting | `GET /` |
| Auth | Password registration/sign-in and access-token issuance | `/auth/register`, `/auth/sign-in` |
| Users | Public profile lookup | `/me` |
| Workspaces | Ownership-scoped collections and cleanup | `/workspaces`, `/workspaces/{workspaceId}` |
| Materials | Validated document storage and extraction status | Workspace material lists/uploads; material reads/rename/delete/text/retry |
| Processing jobs | PostgreSQL queue and extraction completion/failure | Read-only `/materials/{materialId}/jobs`; worker mutations internal |
| Study guides | Store/read validated Markdown content | Material guide lists/creation; guide reads/rename/delete |
| Quizzes | Persist typed quizzes; optional OAuth generation; hide answers while taking | Material quiz lists/creation/generation; quiz reads/rename/delete |
| Attempts | Server grading and immutable assessment history | Quiz attempt lists/submission, personal history and result reads |
| Progress | Aggregate user quiz history | `/me/progress`, `/me/progress/overview` |

The migrated database defines eleven relational tables, four enums and a progress view. These are not
automatically API response models. Only models returned by exposed endpoints
belong in the current public OpenAPI contract.
