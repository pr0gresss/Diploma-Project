# Testing and known limitations

Run from Frontend:

```sh
npm ci
npm test -- --watch=false
npm run build
```

Angular CLI builds the application; Vitest with jsdom executes tests. The audit execution on 2026-11-24 passed 25 tests in six files. This is a dated result, not a guarantee for later revisions.

Tests cover the quiz runner's rendered question types, serialized saves, changes during pending requests, revision conflicts, leave/submit flushing, duplicate submission protection and result navigation. QuizDraftsService tests use HttpTestingController to assert HTTP methods and request bodies. The generation dialog tests exercise validation and partial completion. These provide component/HTTP integration coverage with test doubles, not a real-browser E2E run.

## Limits and follow-up

- No frontend lint command is configured; Prettier is a development dependency.
- Browser global error listeners and the auth interceptor exist. Caught API failures are not consistently logged.
- Some workspace-loading failures clear loading state without a user-facing error.
- 401 redirects are centralized; 403, 404 and 500 handling is feature-dependent.
- API requests use /api through the dev-server/nginx proxy; verify the proxy target if backend networking changes.
- Responsive usability, keyboard behavior, contrast and full WCAG compliance require the [adaptive UI verification](../AdaptiveUI/verification.md).

## Requirements map

| Requirements | Documentation/evidence |
| --- | --- |
| FE-M01–M02 | Architecture diagrams and responsibility description |
| FE-M03 | API services guide, TypeScript contracts and backend reference |
| FE-M04 | User flows |
| FE-M05 | Technology suitability in architecture guide |
| FE-M39–M41 | Executable component, state and HTTP tests |

Documentation describes implementation; it does not turn untested behavior into a passing runtime check.

