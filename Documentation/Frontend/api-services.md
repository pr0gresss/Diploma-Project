# Angular API services

By default, backend calls use the same-origin `/api` prefix and the Angular dev server proxies `/api` to `http://localhost:3000` (see `Frontend/proxy.conf.json`). For local development right now, `API_BASE_URL` in `api.config.ts` points directly at `http://localhost:3000`; switch it back to `/api` to use the proxy. Production nginx uses `/api`.

Bearer tokens are attached automatically by `authInterceptor`. `AuthService.signIn()` and `AuthService.register()` save the `accessToken` and user in `localStorage`; `AuthService.signOut()` clears them. A 401 response from a non-auth endpoint also clears the session and redirects to `/login` with a `returnUrl`. The NestJS backend currently allows CORS from `http://localhost:4200` so the direct local setup works.

## Folder layout

```
Frontend/src/app/shared/services/
├── api.config.ts
├── api.models.ts
├── adapters.ts
├── auth.interceptor.ts
├── app.service.ts
├── auth.service.ts
├── users.service.ts
├── workspaces.service.ts
├── processing-jobs.service.ts
├── materials.service.ts
├── study-guides.service.ts
├── quizzes.service.ts
├── attempts.service.ts
├── progress.service.ts
├── workspace-overview.service.ts
└── repositories/
    ├── app.repository.ts
    ├── auth.repository.ts
    ├── users.repository.ts
    ├── workspaces.repository.ts
    ├── processing-jobs.repository.ts
    ├── materials.repository.ts
    ├── study-guides.repository.ts
    ├── quizzes.repository.ts
    ├── attempts.repository.ts
    └── progress.repository.ts
```

Each repository owns the `HttpClient` calls and raw URLs for one backend controller. The matching service is the public API used by components and state services. `AuthService` additionally owns the token/user signals and localStorage persistence.

## Service and repository map

| Service | Repository | Operations |
| --- | --- | --- |
| `AppService` | `AppRepository` | `GET /` |
| `AuthService` | `AuthRepository` | `POST /auth/register`, `POST /auth/sign-in` |
| `UsersService` | `UsersRepository` | `GET /me` |
| `WorkspacesService` | `WorkspacesRepository` | `GET/POST /workspaces`, `GET/PATCH/DELETE /workspaces/{workspaceId}` |
| `ProcessingJobsService` | `ProcessingJobsRepository` | `GET /materials/{materialId}/jobs` |
| `MaterialsService` | `MaterialsRepository` | `GET/POST /workspaces/{workspaceId}/materials`, `GET/PATCH/DELETE /materials/{materialId}`, `GET /materials/{materialId}/text`, `POST /materials/{materialId}/extraction/retry` |
| `StudyGuidesService` | `StudyGuidesRepository` | `GET/POST /materials/{materialId}/study-guides`, `GET/PATCH/DELETE /study-guides/{guideId}` |
| `QuizzesService` | `QuizzesRepository` | `POST /materials/{materialId}/quizzes/generate`, `GET/POST /materials/{materialId}/quizzes`, `GET/PATCH/DELETE /quizzes/{quizId}` |
| `AttemptsService` | `AttemptsRepository` | `POST/GET /quizzes/{quizId}/attempts`, `GET /attempts/{attemptId}`, `GET /me/attempts` |
| `ProgressService` | `ProgressRepository` | `GET /me/progress`, `GET /me/progress/overview` |

This covers all 34 documented backend operations.

`WorkspaceOverviewService` is an aggregation helper, not an endpoint wrapper. It combines `MaterialsService`, `StudyGuidesService`, `QuizzesService`, and `ProgressService` for the workspace, study notes, and quizzes pages.

## UI wiring

- `/login` and `/register` are standalone pages outside `PlatformTemplateComponent`; they do not render the platform header or side panel. `authGuard` protects platform routes and `guestGuard` keeps authenticated users off the auth pages.
- The login and register forms call `AuthService.signIn()` and `AuthService.register()`. The platform header's account button calls `AuthService.signOut()` and returns to `/login`.
- Side panel navigation links to My workspaces, My notes, and My quizzes. The New workspace control opens a title dialog before sending the entered name to `WorkspacesService.createWorkspace()`.
- `/workspaces` shows all workspaces as cards; Enter workspace opens `/workspaces/{workspaceId}`, the existing workspace detail page. Side panel workspace clicks use the same route.
- `PlatformState` loads workspaces with `WorkspacesService.listWorkspaces()`, creates them with `WorkspacesService.createWorkspace()`, and resolves a deep-linked workspace with `WorkspacesService.getWorkspace()`.
- Workspace page uploads files with `MaterialsService.uploadMaterial()` and reads overview data from `WorkspaceOverviewService`.
- Study notes page reads a guide with `StudyGuidesService.getStudyGuide()` and creates guides with `StudyGuidesService.createStudyGuide()`.
- Quizzes page generates quizzes with `QuizzesService.generateQuiz()`.
- Quiz runner loads a quiz with `QuizzesService.getQuizForTaking()` and submits answers with `AttemptsService.submitQuizAttempt()`.

The old hardcoded data files (`workspace-data.ts`, `quiz-data.ts`, `study-notes.data.ts`) have been removed. Only static UI copy remains in `quiz-ui.config.ts` and component templates.
