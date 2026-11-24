# Figma design context — AI study workspace

Source: <https://www.figma.com/design/RNFgKtSoVHwUNfUweHLUou/Ai-study-workspace?node-id=0-1>

Extracted from the `Platform` canvas (`0:1`) with the Figma MCP `get_design_context` and `get_metadata` tools. The implementation target is the Angular 22 app in `Frontend/`.

## Screens on the canvas

| Screen | Desktop node | Tablet node | Mobile node |
| --- | --- | --- | --- |
| Workspace / files | `3:38` | `3:42` | `3:46` |
| Study notes editor | `3:50` | `3:54` | `3:58` |
| Single-choice quiz | `3:62` | `3:66` | `3:70` |
| Quizzes library | `23:17` | `23:178` | `23:287` |
| Dropdown quiz | `23:398` | `23:559` | `23:668` |
| Multi-choice quiz | `23:779` | `23:940` | `23:1049` |
| My workspaces (tablet) | — | `23:1160` | — |

## Design tokens

- Canvas `#f8f8f6`, surfaces `#fdfdfc` / `#ffffff`, subtle fills `#f6f6f2`, `#f2f1ec`, `#fafaf7`, selected row `#f2f7f0`.
- Ink `#262a28`, muted text `#747970` / `#767a75`.
- Primary green `#26734d`, softer greens `#eaf3e9`, `#d6e8d3`, `#edf2e9`, `#dfe8d9`.
- Borders `#e6e7e0` / `#e7e8e1`, strong border `#cbcdc2`, divider `#eeefe8`, track `#e1e0d7`.
- File badges: PDF `#f8ebe7` / `#a06854`, DOC `#eaf0f7` / `#4d7599`, PPT `#f6ede1` / `#9c7134`.
- Type: Inter for UI (400/500/600/700) and Lora for large headings; body 11–13px, Lora page title 36px, AI studio heading 18px.
- Radii: 6px small, 8px medium, 9px icon tiles, 12px cards.
- Desktop layout: 224px navigation rail, 80px page header, 1216px content area; tablet rail 76px; mobile compact header plus 76px bottom navigation.

## Component inventory

- **Navigation**: brand tile with book icon, My workspaces / Recently opened / Favorites, workspace list with subject markers, New workspace, personal account, header breadcrumbs and search.
- **Workspace**: eyebrow + Lora title, subtitle, Upload files / More actions, Files / Study notes / Quizzes tabs, dashed upload drop zone, files table with checkboxes and per-file action menus, AI study studio cards, recent study activity card.
- **Study notes**: breadcrumb, editable title, saved status, Export / New notes, formatting toolbar, structured note body with key-idea callout and term rows, document outline, source documents, AI writing assistant.
- **Quizzes**: quiz library cards, single-choice / dropdown / multi-choice runners with progress, feedback and explanations.

## Assets

All static SVGs referenced by the extracted contexts are copied to `Frontend/public/icons/` and rendered through `Frontend/src/app/shared/icon/icon.component.ts`. No temporary Figma asset URLs are used at runtime.

## Implementation mapping

- `''` → `WorkspacePageComponent`
- `/study-notes` → `StudyNotesPageComponent`
- `/quizzes` → `QuizzesPageComponent`
- `/quizzes/:mode` → `QuizRunnerComponent` (`single`, `dropdown`, `multi`)

The Figma design context includes a screenshot reference; this agent cannot render images, so implementation is based on the high-fidelity textual design context and node geometry.
