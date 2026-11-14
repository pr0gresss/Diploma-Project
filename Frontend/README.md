# Frontend — Angular SPA

Angular 22 single-page application with SCSS, part of the AI Study Workspace monorepo.

## Structure

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

Run from this folder:

| Command | Description |
| --- | --- |
| `npm start` | Dev server on http://localhost:4200 |
| `npm run build` | Production build into `dist/Frontend` |
| `npm test` | Vitest + jsdom unit tests |
| `npm run watch` | Development build in watch mode |

The build is configured with the SCSS style preprocessor in `angular.json`.
