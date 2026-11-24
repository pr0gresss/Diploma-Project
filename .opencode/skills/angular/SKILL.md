---
name: Angular frontend
description: Build and initialize Angular frontends in this repository, including standalone components, signals, routing, SCSS styling, forms, accessibility, and Angular 22 conventions.
---

# Angular frontend skill

Use this skill when creating, initializing, or modifying the Angular application under `Frontend/`.

## Stack

- Angular 22 with standalone components, zoneless-friendly change detection, TypeScript 6, SCSS, and Vitest.
- The Angular CLI app lives in `Frontend/`; run all npm scripts from that directory.

## Conventions

- Keep every component standalone (`imports` array, no `NgModule`), use `@Component` with `templateUrl` and `styleUrl`.
- Prefer `signal`, `computed`, and `input()` for local/component state; use `output()` for events. Use `ChangeDetectionStrategy.OnPush` for presentational components.
- Use Angular's built-in control flow (`@if`, `@for`, `@switch`) and class/style bindings instead of structural directives.
- Use typed reactive forms (`FormBuilder`, `FormControl`) for editable inputs. Keep form models in the component and expose submit handlers via `output()`.
- Register pages in `src/app/app.routes.ts` with lazy `loadComponent`; use `RouterLink` and `RouterOutlet` for navigation.
- Put reusable design tokens in `src/styles.scss` as CSS custom properties. Keep component-specific styles in the component's `.scss` file and use BEM-like class names.
- Use semantic HTML, visible focus styles, `aria-label`/`aria-pressed` where needed, and keyboard-accessible controls. Do not use `div` for buttons.
- Keep content data in a typed service or model file rather than hardcoding it in templates.
- Avoid any dependency that is not already in `package.json` unless explicitly requested.

## Workflow

1. Inspect `Frontend/src/app`, `angular.json`, `package.json`, and existing components before editing.
2. Create focused feature components under `Frontend/src/app/features/<feature>/` and shared UI under `Frontend/src/app/shared/`.
3. Update routes and root shell only as needed; replace the default Angular welcome template.
4. Run `npm run build` from `Frontend/` and fix type/template errors before finishing.
5. Run `npm test -- --run` when tests exist, and keep specs beside their components.
