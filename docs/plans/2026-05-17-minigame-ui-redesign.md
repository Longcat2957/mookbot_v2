# MiniGame UI Full Redesign Implementation Plan

> **For Hermes:** Use Codex via `/home/min/openclaw_codex_telegram/bin/hermes-codex` to implement this plan task-by-task. Do not use Claude Code.

**Goal:** Rebuild the MiniGame internal game UIs from first principles so coin, ladder, and roulette feel like one coherent compact Discord Activity tool, not three independently patched layouts.

**Architecture:** Keep existing game logic and state hooks. Replace the presentation layer with a shared MiniGame shell, shared control/result primitives, and game-specific stage components. CSS should move from ad-hoc per-game sizing to explicit design tokens, container queries, and predictable stage/control regions.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind/daisyUI utilities, local `apps/activity/src/screens/MiniGame/styles.css`, no new runtime dependencies.

---

## Design Direction

### Product principles

1. **One-screen utility first:** Default 2-6 player cases should fit without awkward dead space or page-level scrolling in the Discord Activity viewport.
2. **Game stage is the hero:** The visual game object should own the main area; controls/results should be secondary but always visible.
3. **Same skeleton, different game:** Coin, ladder, and roulette should share header, controls, result, and candidate-list visual language.
4. **Controlled overflow:** Only the ladder board may horizontally scroll at high player counts. No accidental body/page scrollbars from shadows, min-heights, or viewport-based sizing.
5. **Touch-friendly:** Primary action must be large and stable; editing fields must not collapse below usable tap targets.
6. **Accessible status:** Busy/settled/idle state should be clear visually and via `aria-live` without relying only on animation.

### Visual system

- Container: rounded card, subtle grid/noise background, single stage surface.
- Control panels: compact cards with section headers, inline badges, one primary CTA.
- Color language:
  - BLUE/RED only for coin side identity.
  - Multi-color tokens only for ladder paths/roulette segments.
  - Primary color for active tabs and main CTA.
- Motion:
  - Keep current logic animations, but reduce competing glow/ring effects.
  - Add `prefers-reduced-motion` fallback for coin, ladder, roulette animations.

---

## Scope

### In scope

- `apps/activity/src/screens/MiniGame.tsx`
- `apps/activity/src/screens/MiniGame/CoinFlip.tsx`
- `apps/activity/src/screens/MiniGame/Ladder.tsx`
- `apps/activity/src/screens/MiniGame/Roulette.tsx`
- `apps/activity/src/screens/MiniGame/styles.css`
- MiniGame child components under:
  - `apps/activity/src/screens/MiniGame/Ladder/`
  - `apps/activity/src/screens/MiniGame/Roulette/`

### Out of scope

- Random/result logic changes, unless required to fix UI race conditions.
- Server, API, bot, database, Discord command changes.
- New libraries.
- Global app shell redesign outside MiniGame.

---

## Current Problems to Solve

1. `styles.css` is now a long single stylesheet mixing shell, controls, coin, ladder, roulette, and animation concerns.
2. Coin layout uses side rails plus separate side cards, causing duplicate information and cramped mobile composition.
3. Ladder input labels live in the control panel while output labels live below the board, creating split mental model and alignment complexity.
4. Roulette control panel mixes count slider, label editing, result, candidate chips, and CTA in one vertical stack with weak hierarchy.
5. Game components do not share a consistent status/result component.
6. Breakpoints are improved but still reactive patchwork rather than a deliberate layout system.
7. Animation CSS lacks a unified reduced-motion strategy.

---

## Target Component Shape

```text
MiniGame.tsx
└─ MiniGameShell
   ├─ MiniGameHeader
   ├─ MiniGameTabs
   └─ MiniGameCard
      ├─ GameStageRegion
      │  └─ game-specific visual stage
      └─ GameControlRail
         ├─ GameStatusCard
         ├─ game-specific settings
         ├─ candidate/side list
         └─ GameActionBar
```

Recommended new shared file:

- `apps/activity/src/screens/MiniGame/shared.tsx`

Recommended CSS organization inside the existing CSS file first:

```css
/* Tokens */
/* Shell */
/* Shared game layout */
/* Shared controls */
/* Coin */
/* Ladder */
/* Roulette */
/* Motion accessibility */
```

Do not split CSS into multiple imports unless it clearly improves maintainability after the first pass.

---

## Implementation Tasks

### Task 1: Create shared MiniGame UI primitives

**Objective:** Add reusable layout/control components so the three games stop hand-rolling panels and result areas.

**Files:**

- Create: `apps/activity/src/screens/MiniGame/shared.tsx`
- Modify: `apps/activity/src/screens/MiniGame/styles.css`

**Steps:**

1. Create `shared.tsx` with these exports:
   - `MiniGameLayout`
   - `MiniGameStage`
   - `MiniGameControls`
   - `MiniGameSection`
   - `MiniGameStatusCard`
   - `MiniGameActionBar`
2. Keep the components thin; they should mostly compose class names and children.
3. Add CSS classes:
   - `.mg-layout`
   - `.mg-layout-controls-left`
   - `.mg-layout-controls-right`
   - `.mg-stage`
   - `.mg-stage-header`
   - `.mg-controls`
   - `.mg-section`
   - `.mg-section-title`
   - `.mg-status-card`
   - `.mg-action-bar`
4. Preserve existing class names temporarily as aliases where useful to avoid a huge one-shot rewrite.

**Verification:**

- Run: `pnpm --filter @mookbot/activity typecheck`
- Expected: pass.

---

### Task 2: Redesign MiniGame top-level shell and tabs

**Objective:** Make the MiniGame entry screen feel like a compact game toolbox with clear current tool context.

**Files:**

- Modify: `apps/activity/src/screens/MiniGame.tsx`
- Modify: `apps/activity/src/screens/MiniGame/styles.css`

**Steps:**

1. Replace the current header with a two-line compact header:
   - eyebrow: `MINIGAME`
   - title: selected tool label
   - description: selected tool purpose, e.g. coin = `BLUE/RED 진영을 즉시 결정합니다.`
2. Extend `TOOLS` metadata with:
   - `description`
   - `accent`
   - `actionLabel` if useful later.
3. Redesign tabs as segmented cards with active accent and short description.
4. Ensure mobile tabs remain 3 columns but reduce icon prominence and hide long descriptions if needed.
5. Keep `대시보드` back button in the header.

**Verification:**

- Run: `pnpm --filter @mookbot/activity typecheck`
- Manually inspect at widths: 390px, 768px, 1100px.

---

### Task 3: Rebuild Coin UI from scratch

**Objective:** Make coin toss visually focused and remove duplicate/awkward side information.

**Files:**

- Modify: `apps/activity/src/screens/MiniGame/CoinFlip.tsx`
- Modify: `apps/activity/src/screens/MiniGame/styles.css`

**Design:**

- Stage region:
  - central coin
  - left/right subtle background zones or bottom side badges, not both vertical rails and side cards.
  - status pill above or below coin: `대기`, `회전 중`, `결과 확정`.
- Control rail:
  - one `MiniGameStatusCard` showing result or pending state.
  - compact side legend: BLUE / RED.
  - one primary CTA: `던지기` / `다시 던지기`.
  - secondary reset only after settled.

**Steps:**

1. Replace the current `mg-side-score` rails with a new `.mg-coin-arena` containing:
   - `.mg-coin-side-pill` for BLUE
   - coin stage
   - `.mg-coin-side-pill` for RED
   On narrow screens, pills should become horizontal top/bottom badges.
2. Use shared `MiniGameLayout`, `MiniGameStage`, `MiniGameControls`, `MiniGameStatusCard`, and `MiniGameActionBar`.
3. Keep existing `flip`, `reset`, timer cleanup, and rotation logic.
4. Add `aria-live="polite"` to the result/status card only.
5. Add reduced-motion handling in CSS:
   - disable bob/ring infinite animation
   - shorten or remove transitions for coin transform if `prefers-reduced-motion: reduce`.

**Verification:**

- Run: `pnpm --filter @mookbot/activity typecheck`
- Interaction check:
  - idle shows no result
  - click `던지기` disables CTA
  - result appears only after settle
  - reset returns to idle

---

### Task 4: Rebuild Roulette UI from scratch

**Objective:** Make roulette editing and result reading clear while keeping the wheel dominant.

**Files:**

- Modify: `apps/activity/src/screens/MiniGame/Roulette.tsx`
- Modify: `apps/activity/src/screens/MiniGame/Roulette/RouletteControls.tsx`
- Modify: `apps/activity/src/screens/MiniGame/Roulette/RouletteResult.tsx`
- Modify: `apps/activity/src/screens/MiniGame/Roulette/RouletteWheel.tsx`
- Modify: `apps/activity/src/screens/MiniGame/styles.css`

**Design:**

- Stage region:
  - large wheel centered
  - fixed pointer at top
  - small result banner below wheel only when settled/spinning.
- Control rail:
  - count slider section
  - label editor section
  - candidate color list section collapses/condenses for high counts
  - action bar at bottom.

**Steps:**

1. Move candidate chips into `RouletteControls` or a new `RouletteCandidateList` component so all editing/list concerns are together.
2. Convert `RouletteResult` into a shared status-card compatible component or inline it using `MiniGameStatusCard`.
3. Keep `RouletteWheel` focused only on visual wheel/pointer/labels.
4. Improve label legibility:
   - cap displayed text with CSS truncation
   - for high segment count, hide labels on wheel and rely on color list if needed.
5. Add CSS classes:
   - `.mg-roulette-arena`
   - `.mg-roulette-result-banner`
   - `.mg-candidate-list`
   - `.mg-candidate-chip`
6. Add reduced-motion handling for spin transitions.

**Verification:**

- Run: `pnpm --filter @mookbot/activity typecheck`
- Manual checks:
  - count 2, 4, 8 all usable
  - labels remain editable before spin
  - controls disabled while spinning
  - result matches selected index label

---

### Task 5: Rebuild Ladder UI from scratch

**Objective:** Make ladder setup and result flow understandable without split/fragile alignment.

**Files:**

- Modify: `apps/activity/src/screens/MiniGame/Ladder.tsx`
- Modify: `apps/activity/src/screens/MiniGame/Ladder/LadderControls.tsx`
- Modify: `apps/activity/src/screens/MiniGame/Ladder/LadderLabelGrid.tsx`
- Modify: `apps/activity/src/screens/MiniGame/Ladder/LadderResults.tsx`
- Modify: `apps/activity/src/screens/MiniGame/Ladder/LadderStage.tsx`
- Modify: `apps/activity/src/screens/MiniGame/styles.css`

**Design:**

- Control rail:
  - participant count
  - input labels
  - output labels
  - action bar
- Stage region:
  - board only, with top labels rendered inside/above the SVG and output labels inside/below the SVG, so visual alignment is owned by the board.
  - result summary below or right as compact cards.
- Overflow rule:
  - 2-6 players should fit naturally.
  - 7-8 players may horizontally scroll inside the stage only.

**Steps:**

1. Decide one source of truth for visible labels:
   - Prefer rendering labels as HTML grid rows above/below `LadderStage` inside `.mg-ladder-board`.
   - Keep label inputs in control rail only.
2. Remove duplicated label grids from below the stage if they are only for editing.
3. Add a board wrapper that contains:
   - top label row
   - SVG board
   - bottom label row
4. Keep SVG interaction nodes accessible.
5. Redesign `LadderResults` as compact `input → output` cards using trace colors.
6. Add reduced-motion fallback for path/dot animations.

**Verification:**

- Run: `pnpm --filter @mookbot/activity typecheck`
- Manual checks:
  - 2, 4, 8 player counts
  - start individual input
  - start all
  - reset
  - labels align with columns

---

### Task 6: Consolidate and delete legacy CSS/classes

**Objective:** Remove the old patched layout system after all games use the new primitives.

**Files:**

- Modify: `apps/activity/src/screens/MiniGame/styles.css`
- Modify: any MiniGame TSX still referencing old classes.

**Steps:**

1. Search for legacy classes:
   - `mg-game-layout`
   - `mg-play-surface`
   - `mg-control-panel`
   - `mg-result-panel`
   - `mg-side-score`
   - `mg-side-card`
2. Replace with new primitives/classes or keep only intentional aliases.
3. Reorder CSS into the target sections.
4. Add one `@media (prefers-reduced-motion: reduce)` block at the bottom covering all MiniGame animations.
5. Run class reference search to ensure removed classes are unused.

**Verification:**

- Run: `pnpm --filter @mookbot/activity typecheck`
- Run: `pnpm --filter @mookbot/activity build`

---

### Task 7: Visual QA pass with local browser

**Objective:** Catch layout regressions before commit/deploy.

**Files:**

- No intended code changes unless QA finds issues.

**Steps:**

1. Start local dev server:
   ```bash
   pnpm --filter @mookbot/activity exec vite --host 127.0.0.1 --port 5179
   ```
2. If Discord auth blocks direct app rendering, add a temporary local-only harness only if necessary:
   - Create a throwaway route/harness file and remove it before commit, or ask Codex to inspect with component screenshots if available.
3. Test viewport widths:
   - 390x844
   - 768x900
   - 1100x760
4. For each game, test idle, busy, settled, reset states.
5. Check browser console after interactions.
6. Verify no body horizontal scrollbar.

**Verification:**

- Screenshots or written QA notes in the Codex report.
- No temporary harness files left in `git status`.

---

### Task 8: Final verification and commit

**Objective:** Ensure the redesign is safe to ship.

**Files:**

- All modified MiniGame files.

**Steps:**

1. Run:
   ```bash
   git diff --check
   pnpm test
   pnpm typecheck
   pnpm build
   ```
2. Inspect:
   ```bash
   git diff --stat
   git diff -- apps/activity/src/screens/MiniGame.tsx apps/activity/src/screens/MiniGame apps/activity/src/screens/MiniGame/styles.css
   ```
3. Commit:
   ```bash
   git add apps/activity/src/screens/MiniGame.tsx apps/activity/src/screens/MiniGame docs/plans/2026-05-17-minigame-ui-redesign.md
   git commit -m "refactor(activity): redesign minigame UI"
   ```
4. Do not push/deploy unless explicitly requested after review.

**Verification:**

- Working tree clean after commit.
- All gates pass.

---

## Acceptance Criteria

- Coin, ladder, and roulette share a consistent layout and control vocabulary.
- No accidental horizontal page scrollbar at common Discord Activity widths.
- Only ladder stage may scroll horizontally, and only for high player counts.
- Primary CTA is always visible without searching.
- Results are visually obvious and announced through `aria-live`.
- Label editing remains usable on mobile.
- `prefers-reduced-motion` does not show continuous decorative animation.
- `pnpm test`, `pnpm typecheck`, and `pnpm build` pass.

---

## Recommended Execution Strategy

Implement in small Codex work units:

1. Shared primitives + shell.
2. Coin redesign.
3. Roulette redesign.
4. Ladder redesign.
5. CSS cleanup + reduced motion.
6. Visual QA + final fixes.
7. Full verification + commit.

Each Codex prompt should include:

- Work in `/home/min/workspace/mookbot_v2`.
- Preserve unrelated files.
- Scope to MiniGame files only.
- Do not commit unless the final task explicitly asks for commit.
- Run the narrow verification for the task and report changed files.
