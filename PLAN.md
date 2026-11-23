# PLAN: QA audit fixes (mineru-view)

> Branch: `fix/qa-audit-fixes` (from `feat/e2e-testing`) · Date: 2026-11-24 · Status: Implemented and verified.

## Context & Findings

From `/Users/ding/GitHub/OBSIDIAN_PLUGINS_QA_REPORT.md`:

1. **BUG-07 (P2)**: Nested caption boxes inside MinerU 2.0 `image` containers can get duplicate reading-order badge numbers (e.g. `image_caption` with local index `1` gets badge `2`, colliding with top-level block `2`).
2. **BUG-09a (P3)**: `Results folder` setting accepts `.obsidian/x` or `..` with no inline validation feedback.
3. **BUG-09b (P3)**: Legend swatches share colors: **Formula** and **Image** are both green; **Image caption** and **Heading** are both blue.
4. **Settings & UX audit + Interop**:
   - Single-row **Results** group holds only `Results folder`.
   - Clicking a PDF with no MinerU result opens a one-line modal instead of a `Notice`.
   - Add `flex-shrink: 0` on `.mineru-toolbar-button` so sibling toolbar plugins never squeeze or hide it.

## Verified Root Causes & Fix Design

1. **Unique reading-order labels (`src/mineru/boxNormalizer.ts`)**:
   - In `assignPageIndexLabels`, require `sourceIndex` on a page to be both present on all boxes **and unique** across the page before using `(sourceIndex as number) + 1`; otherwise fall back to `position + 1`.
   - In `emitV2VisualContainer`, when `body` and container `block` have differing numeric `sourceIndex` values (indicating container-local child indexing rather than MinerU's page-global indexing), omit `sourceIndex` on the child annotations so `assignPageIndexLabels` assigns unique sequential page order.
2. **Results folder validation (`src/results/paths.ts`, `src/settingsModel.ts`, `src/settings.ts`)**:
   - Add `checkResultsFolder(raw, configDir)` rejecting `..`, `configDir` (`.obsidian`), and hidden dot-folder segments while preserving empty string (`""` = vault root) and `cleanFolderPath("./MinerU")`.
   - Wire `validate` on the `Results folder` setting control.
3. **Distinct box/legend colors (`src/overlay/boxColors.ts`, `styles.css`)**:
   - Move `image`/`figure`/`image_body`/`chart`/`chart_body` to burnt orange (`[0.85, 0.35, 0.1]`), `image_footnote`/`chart_footnote` to amber-brown (`[0.65, 0.35, 0.05]`), and `image_caption`/`chart_caption` to rose-magenta (`[0.8, 0.25, 0.55]`), then regenerate the `/* BEGIN type colors */` block in `styles.css`.
4. **Settings & Notice polish (`src/settings.ts`, `src/main.ts`, `styles.css`)**:
   - Place `Results folder` directly at top level above `Layout overlay` without a single-row group heading.
   - Show a `Notice` in `openLegend()` when `!controller.result`.
   - Add `flex-shrink: 0` to `.mineru-toolbar-button`.

## Order of Work

1. `[x]` Fix nested box reading-order numbering (`src/mineru/boxNormalizer.ts`) and add unit tests (`test/boxNormalizer.test.ts`).
2. `[x]` Add inline `Results folder` validation (`src/results/paths.ts`, `src/settingsModel.ts`, `src/settings.ts`) and unit tests (`test/paths.test.ts`).
3. `[x]` Separate Formula/Image and Heading/Image-caption colors (`src/overlay/boxColors.ts`, `styles.css`, `test/boxColors.test.ts`).
4. `[x]` Remove single-row `Results` group, replace empty-result legend modal with `Notice`, add `flex-shrink: 0` on toolbar button, run all checks/tests, mark plan verified, and push `fix/qa-audit-fixes`.

## Verification Plan

- `npm run build`
- `npm run check:mobile`
- `npm run lint`
- `npm run lint:review` (0 errors, 0 warnings)
- `npm test`
