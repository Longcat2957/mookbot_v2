# Design Upgrade Phase 0-1

## Scope

The design upgrade keeps the current app layout intact. The first pass standardizes how
screens express surfaces, status, dense rows, notices, menus, and icon actions before
screen-by-screen visual changes start.

## Current daisyUI Baseline

- Installed in `apps/activity`: `daisyui@^5.5.19`.
- Enabled from `apps/activity/src/index.css` with Tailwind CSS 4 plugin syntax.
- Default theme order: `dark --default, light`.
- Existing high-usage components: `card`, `btn`, `badge`, `navbar`, `dropdown`, `menu`,
  `modal`, `toast`, `alert`, `tabs`, `steps`, `stats`, `progress`, `radial-progress`,
  `skeleton`, `tooltip`, `join`, `toggle`, `input`, `select`.

## Component Policy

### Keep

- `card` for bounded content groups.
- `btn` for commands and icon buttons.
- `badge` for short status labels.
- `alert` for blocking or important inline notices.
- `tabs` for switching logical views in the same layout slot.
- `steps` for linear process progress.
- `stats`, `progress`, `radial-progress` for numeric summaries.
- `modal`, `dropdown`, `menu`, `toast`, `tooltip` for overlays and transient UI.

### Add More Deliberately

- `list` / `list-row`: repeated dense rows such as candidates, members, recent games.
- `table`: leaderboard, auction rosters, result summaries, and other scan-heavy data.
- `status` / `indicator`: compact live state, saved state, active state, or attention flags.
- `join`: segmented controls and compact button groups.

### Avoid For This Upgrade

- `drawer`: changes navigation/layout model.
- `hero`: pushes screens toward landing-page composition.
- `carousel`: low value for operational workflows.
- `mockup-*`: decorative, not useful for current app surfaces.
- `dock`: would compete with the existing footer/navigation.

## Primitive Layer

Added `apps/activity/src/components/DesignPrimitives.tsx`.

### `PanelCard`

Standard card wrapper for app panels.

- Keeps `card`, `surface-*`, border, and shadow usage consistent.
- Supports status borders with semantic daisyUI colors.
- Use for repeated page panels, not for nested cards inside other cards.

### `SectionHeader`

Standard section title + description + right actions layout.

- Use at the top of dashboard sections, entry panels, profile panels, and auction panels.
- Keeps action placement stable without changing page-level layout.

### `StatusBadge`

Small status label wrapper.

- Use for recruitment status, permissions, save state, game result, auction state.
- Prefer semantic tones: `info`, `success`, `warning`, `error`, `primary`, `neutral`.

### `InlineNotice`

Inline alert wrapper.

- Use for read-only state, warnings, recoverable errors, and informational notices.
- Keeps `alert alert-soft` tone usage consistent.

### `ActionMenu`

Dropdown + menu wrapper.

- Use for "more actions" menus in headers and cards.
- Keeps width, border, z-index, and danger action styling consistent.

### `DataListRow`

Dense repeated row wrapper.

- Use with daisyUI `list` for candidate/member/recent-game rows.
- Designed for layout-preserving replacements of hand-written row flex markup.

### `IconButton`

Icon-only button wrapper.

- Keeps `btn-circle`, `aria-label`, and optional tooltip together.
- Prefer for search/help/refresh/close/back style controls.

## Screen Application Matrix

| Area | Current Layout | Main Primitive Targets | daisyUI Components |
| --- | --- | --- | --- |
| Dashboard | Keep stacked sections | `PanelCard`, `SectionHeader`, `StatusBadge` | `card`, `badge`, `list`, `join`, `skeleton` |
| Entry Editing | Keep header, notices, slot board, candidate pool | `InlineNotice`, `PanelCard`, `DataListRow`, `ActionMenu` | `alert`, `card`, `list`, `badge`, `tooltip` |
| Pick/Ban | Keep game flow and board | `InlineNotice`, `StatusBadge`, `IconButton` | `tabs`, `join`, `badge`, `alert`, `progress` |
| Auction Draft | Keep full-width layout | `SectionHeader`, `PanelCard`, `DataListRow` | `stats`, `progress`, `table`, `list`, `steps` |
| Auction Bracket | Keep wide cards | `PanelCard`, `ActionMenu`, `StatusBadge` | `card`, `badge`, `table`, `join` |
| Results | Keep result screen flow | `PanelCard`, `DataListRow`, `StatusBadge` | `timeline`, `list`, `stats`, `badge` |
| Profile | Keep profile panels | `PanelCard`, `SectionHeader` | `tabs`, `stats`, `progress`, `table` |
| Leaderboard | Keep current screen | `SectionHeader` | `table`, `tabs`, `skeleton` |

## QA Rules

- Run `pnpm check` after each screen group.
- Run `pnpm test` for behavior-sensitive changes.
- Run `pnpm build` before a release commit.
- Check dark and light themes.
- Check mobile widths for text overflow.
- Check dropdown, modal, tooltip z-index against the existing convention.
- Keep auction screens full-width.
