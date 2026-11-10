# AGENTS.md

Instructions for any coding agent (or human) working in this repository.
This file is the operational reference and architectural constraint guide.

## What this repo is

An Obsidian desktop plugin that draws MinerU's layout analysis (block boxes,
types, reading order) over Obsidian's built-in PDF viewer, and lets the user
copy a block's content or a link to it. v1 only views results that already
exist in the vault; calling the MinerU API is planned (`src/mineru/client.ts`
is the seam, interface only).

The pure layout code is ported from
[mineru-for-zotero](https://github.com/dingzy53/mineru-for-zotero), which is
why the license is AGPL-3.0. `PLAN.md` is the approved v1 plan.

## Commands

- `npm install`
- `npm run dev` — esbuild watch build, outputs `main.js`
- `npm run build` — typecheck + production bundle
- `npm run lint` — keep the eslint config passing
- `npm run lint:review` — what Obsidian's community plugin scanner checks
  (`eslint.review.config.mjs`); see "Documented exceptions"
- `npm test` — vitest unit tests
- `npm run version` — sync the version across package.json, manifest.json and
  versions.json

## Hard constraints — do not violate these

1. **Viewer knowledge lives in `src/pdf/viewerAdapter.ts` only.** Obsidian
   does not document the PDF viewer's DOM. Every selector for it (`.page`,
   `data-page-number`, `data-loaded`, `.canvasWrapper`, `.pdf-toolbar`) is in
   that file, so an Obsidian update is fixed in one place. Use DOM queries
   only: no pdf.js object of the viewer, no private property of the view
   (`view.viewer`, `child`, `pdfViewer`), no patching of Obsidian functions.
   Page sizes come from the official `loadPdfJs()` on the file's bytes
   (`src/pdf/pageGeometry.ts`).
2. **No Node, no Electron, no network.** The plugin is `isDesktopOnly` but
   needs none of them; `obsidianmd/no-nodejs-modules` and a restricted import
   enforce it. v1 makes no request of any kind.
3. **Overlays must survive pdf.js.** `PDFPageView.reset()` removes every
   child of a page it does not own (on zoom, rotation, and when a page is
   recycled). `OverlayController` therefore re-mounts missing layers from a
   `MutationObserver`, batched per animation frame. `sync()` must stay
   idempotent (add only what is missing), or it loops on its own mutations.
4. **Popout windows.** Never use the global `document`/`window` for a view's
   elements: use `el.doc`, `el.win`, `el.instanceOf()`, and the window's own
   `MutationObserver`/`requestAnimationFrame`. A view moved to another window
   is handled through `onWindowMigrated`.
5. **Clean up completely.** Disabling the plugin removes every layer and
   toolbar button (`OverlayController.destroy`); listeners on layer elements
   die with the element, everything else goes through `register*`.
6. **Never read `structured_content.json` as a layout.** It has
   `pages[].blocks[].bbox` but no `schema`; the legacy path would divide its
   bboxes by a page size it does not have (`src/mineru/selectRawJson.ts`).
7. **No static style assignments.** Positions go through CSS custom
   properties (`el.setCssProps`) and rules in `styles.css`. The type palette
   in `styles.css` is generated from `src/overlay/boxColors.ts`;
   `test/boxColors.test.ts` fails when they differ.
8. **Keep the AGPL attribution.** Files ported from mineru-for-zotero carry a
   header naming their source; keep it when editing them.

## Conventions worth knowing

- Pages are 1-based everywhere (`page_idx + 1`), matching `data-page-number`.
  MinerU's image names use the 0-based index (`page_2_image_0.jpg` is page 3).
- A box's badge is `pageIndexLabel`: MinerU's per-page `index + 1`, as in its
  `layout.pdf`. Captions and footnotes are separate boxes with their own index
  (a change from the Zotero plugin, where they are folded into the container).
- Boxes are normalized 0–1 with the origin at the top left. Link rects are PDF
  user space, y up, rounded: `src/pdf/rect.ts`.
- A result is found at `<results folder>/<pdf basename>/`; two PDFs with the
  same basename share it (documented in the README).

## Layout

```
src/main.ts               Plugin entry: settings, commands, one controller per
                          PDF view, vault events → result invalidation
src/settings.ts           PluginSettingTab on the declarative settings API
src/settingsModel.ts      Settings schema, defaults, validation (pure)
src/mineru/               Pure, no obsidian import
  domain.ts               NormalizedBox and shared types
  boxNormalizer.ts        middle JSON (docvortex 2.0, legacy pdf_info) → boxes
  selectRawJson.ts        which JSON of a result folder is the layout
  client.ts               interface for the future MinerU API client
src/results/
  paths.ts                result folder path logic (pure)
  store.ts                finds, reads and caches results through the Vault API
src/pdf/
  viewerAdapter.ts        the only place with PDF viewer selectors (rule 1)
  pageGeometry.ts         page view boxes via loadPdfJs(), cached
  rect.ts                 normalized box → PDF rect (pure)
src/overlay/
  controller.ts           per-view lifecycle, re-mounting, mode
  render.ts               builds a page layer: boxes, badges, arrows
  toolbar.ts              the PDF toolbar button
  legend.ts               legend modal with per-type switches
  boxes.ts                grouping, reading order, type labels (pure)
  boxColors.ts            MinerU's type palette, styles.css generator (pure)
src/copy/
  boxMenu.ts              the menu of a box
  copyFormatter.ts        formulas and tables as text (pure)
  links.ts                link and embed strings (pure)
styles.css                layer, box, badge, arrow, legend, type palette
test/                     vitest; fixtures are MinerU 3.4.4 output for two
                          public arXiv papers
```

Hover mode and the type label are CSS only (`.mineru-mode-hover`, `:hover`),
so there is no hover module.

## Documented exceptions

- **`npm run lint:review` reports one finding**: `validate-manifest`, "Plugin
  name must not include the word Obsidian". The name "MinerU for Obsidian" and
  id `mineru-for-obsidian` were chosen in the plan; the community directory
  will reject both, so they must change before submission (the id cannot
  change after publication). Everything else must report nothing.
- **Viewer internals: none.** If one becomes unavoidable, put it in
  `viewerAdapter.ts` with a per-line `eslint-disable` and a justification, and
  list it here.

## Style

- Strict TypeScript, tabs; justify any `any` with a comment.
- Keep the modules marked "pure" free of `import "obsidian"` (type imports
  are fine); `eslint.config.mjs` enforces it. New logic goes there when it
  can, with a unit test.
- UI text in sentence case; interface colors from Obsidian's CSS variables.

## Definition of done for any change

- `npm run build`, `npm run lint` and `npm test` pass; `npm run lint:review`
  shows only the documented exception.
- Checked in a real vault on a PDF with a result:
  - boxes line up, and come back after zooming, after scrolling far away and
    back, and in a popout window;
  - all / hover / off work from the toolbar and the commands;
  - a box's menu copies correct text, and a copied link opens the right page;
  - disabling the plugin leaves no `.mineru-*` element behind.
- Settings changes persist across a restart.

## When in doubt

Consult `README.md`, `PLAN.md` and this file first. If a constraint needs to
change based on real data, update `README.md` and `AGENTS.md` in the same
change.
