# Frontend — Angular SPA

Angular 22 single-page application with SCSS, part of the AI Study Workspace monorepo.

## Documentation guides

- [Architecture, routes, state and technology choices](architecture.md)
- [API services and contracts](api-services.md)
- [User flows](user-flows.md)
- [Testing and limitations](testing.md)
- [Adaptive UI](../AdaptiveUI/README.md)

## Source structure

```
src/
├── app/
│   ├── app.ts          # root component
│   ├── app.html
│   ├── app.scss
│   ├── app.config.ts   # application providers
│   └── app.routes.ts   # routes
├── styles.scss         # global styles (SCSS)
├── index.html
└── main.ts
```

## Commands

Run from the repository's `Frontend/` folder:

| Command | Description |
| --- | --- |
| `npm start` | Dev server on http://localhost:4200 |
| `npm run build` | Production build into `dist/Frontend` |
| `npm test` | Vitest + jsdom unit tests |
| `npm run watch` | Development build in watch mode |

The build is configured with the SCSS style preprocessor in `angular.json`.

## Quiz generation

The quizzes page opens a generation dialog with material selection, question type,
and a question count from 1 to 50. Workspace file selections are carried into the
same dialog when Generate quiz is clicked. Only READY documents can be generated.
Question types include single choice, dropdown, multi select, and mixed types.

The backend supports one source material per quiz. Selecting several documents
therefore creates separate quizzes sequentially. If a request fails, completed
quizzes are retained and Retry remaining skips those successful documents.
