# Accessibility and browser verification

## Current implementation

The application includes native form controls, labels, dialog elements, button semantics and selected ARIA/live-region feedback. The quiz runner announces saving state; generation errors use an alert role. These individual features do not establish whole-application WCAG 2.1 AA compliance.

Known issue: header controls include 32px buttons, below the diploma requirement of 44px. Some sidebar controls are also smaller. Check the complete clickable area, not only the icon, before recording a measured failure.

Browser-global error listeners are unrelated to accessibility verification. jsdom component tests do not demonstrate visual layout, focus visibility, contrast or actual touch usability.

## Manual verification matrix

All checks below are **PENDING**. Proposed viewports are representative test cases, not a declaration of supported devices.

| Scenario | Viewport/settings | Acceptance |
| --- | --- | --- |
| Mobile portrait | 390 × 844 | Navigation available; forms, lists and actions usable |
| Small mobile | 320 × 568 | No inaccessible controls or unintended horizontal clipping |
| Mobile landscape | 844 × 390 | Scrolling and navigation remain functional |
| Tablet portrait | 768 × 1024 | Workspace tools, tables and dialogs remain usable |
| Tablet landscape | 1024 × 768 | No overlap at layout transitions |
| Desktop | 1440 × 900 | Main and side columns render without clipping |
| Browser zoom | 200%, desktop | Content reflows and essential actions remain reachable |
| Keyboard | Tab, Shift+Tab, Enter, Space, Escape | Logical order, visible focus and usable controls/dialogs |
| Dialog focus | Open, interact, close | Focus enters dialog, stays appropriately contained and returns |
| Touch targets | Measure interactive bounds | All applicable controls meet the specified 44px minimum |
| Contrast | All text and interaction states | Normal text at least 4.5:1; record measured color pairs |
| Virtual keyboard | Real/emulated mobile input | Active input and essential actions remain reachable |
| Content stress | Long names, many files, long quiz prompts | Wrapping/scrolling preserves access |
| Async states | Slow API, 401/403/404/500, failed saves | Progress and understandable feedback remain available |
| Media | SVG icons and font fallback | No distortion or loss of meaning |

Test login, registration, workspace listing/detail, notes, quiz listing, generation dialog, runner and results. Include loading, empty, error, selected, disabled and focus states.

Record browser/version, viewport, route, date, steps, expected/actual result and screenshot reference for every failure. Record actual results separately from this checklist. Use an accessibility scanner alongside manual keyboard and visual checks; a clean scanner result alone does not prove WCAG compliance.

