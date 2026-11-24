# Project documentation

AI Study Workspace is a diploma project with a NestJS backend, an Angular frontend,
PostgreSQL, private local or R2 storage, and Apache Tika document extraction.

For startup commands, begin with the [backend README](../Backend/README.md).

| Folder | Contents |
| --- | --- |
| [Backend](Backend/README.md) | Application structure, commands, environment configuration, and extraction |
| [Backend/API](Backend/API/README.md) | Swagger/OpenAPI reference, HTTP examples, authentication, and integration guides |
| [Backend/AI](Backend/AI/README.md) | AI provider configuration and optional OpenAI OAuth setup |
| [Backend/Storage](Backend/Storage/README.md) | Private object storage and Cloudflare R2 setup |
| [Database](Database/README.md) | Schema, data dictionary, integrity rules, Prisma migrations, roles, and test data |
| [Frontend](Frontend/README.md) | Angular structure, development server, and build commands |
| [Adaptive UI](AdaptiveUI/README.md) | Responsive layouts, design conventions, accessibility and verification |
| [Deployment](Deployment/README.md) | Docker stack setup, operations, and deployment limitations |

The [project overview](PROJECT.md) includes local development and database initialization
instructions. The [backend service review](Backend/SERVICE_REVIEW.md) records the
implementation status and remaining limitations.

Generated API artifacts live alongside the API guides. Run `npm run docs:generate`
and `npm run docs:check` from `Backend/` to regenerate and validate them.
