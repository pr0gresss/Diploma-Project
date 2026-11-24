# Responsive layout and design conventions

## Layout behavior

The shell, header and sidebar use desktop, tablet and mobile media-query branches. Common boundaries are below 700px, 700–1099px and 1100px upward. Individual features have additional boundaries, including the runner at 720px and workspace adjustments below 1300px. These are code breakpoints, not proof of device compatibility.

Desktop workspace content uses a two-column grid. Tablet layouts rearrange studio tools and hide some secondary content. Mobile layouts stack content, simplify file tables and expose a bottom navigation bar. The sidebar becomes an off-canvas panel controlled by PlatformState.mobileMenuOpen.

The quiz runner changes from a main/side layout to a single column, with mobile question controls and navigation tiles adapted separately. Workspace cards use an auto-fill grid and collapse to one column at narrow widths.

The generation dialog uses a bounded viewport-relative width and maximum height. Check scrolling and focus with long material lists and the virtual keyboard open.

## Shared visual conventions

Global tokens in [styles.scss](../../Frontend/src/styles.scss) define surface, text, brand, error and border colors, typography and corner radii. Component SCSS supplies local layout. Inter and Lora have fallback font stacks. SVG icon components provide scalable iconography.

Grid, Flexbox, percentages, minmax and viewport-relative dimensions coexist with fixed pixel typography and controls. Extensive inline workspace styles and important overrides remain maintainability concerns. No theme toggle or complete dark theme is implemented.

## Responsive navigation

Mobile bottom navigation remains visible through fixed positioning; the sidebar can be opened separately. Verify that fixed navigation does not obscure page actions, dialogs or focused inputs. Navigation visibility in CSS alone does not establish usability.

## Requirement evidence

| IDs | Current evidence and limitation |
| --- | --- |
| UI-M01–M05 | Device/orientation layout branches exist; usability and layout integrity need browser verification |
| UI-M06 | Relative dimensions, bounded widths and responsive grid mechanisms exist |
| UI-M07 | Zoom verification pending |
| UI-M08 | SVG icons scale; typography/media rendering still needs visual checks |
| UI-M09 | Some controls are below the required 44px size |
| UI-M10–M11 | Contrast and applicable WCAG checks pending |
| UI-M12 | Shared palette and typography tokens exist |
| UI-M13 | Grid and Flexbox are used in actual page layouts |
| UI-M14–M15 | Content restructuring and mobile navigation exist; runtime verification pending |

