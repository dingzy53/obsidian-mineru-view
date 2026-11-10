/**
 * Everything this plugin knows about the DOM of Obsidian's built-in PDF
 * viewer, in one place. Obsidian does not document this DOM, so an update may
 * change it; fixes then belong here and nowhere else (AGENTS.md rule 1).
 *
 * Only DOM queries are used: no pdf.js object and no private property of the
 * view is touched.
 *
 *   view.containerEl
 *     .pdf-toolbar > .pdf-toolbar-left, .pdf-toolbar-right
 *     .pdf-viewer-container > .pdfViewer > .page[data-page-number]
 *       (canvasWrapper, textLayer, annotationLayer; `data-loaded` once rendered)
 */

const PAGE_SELECTOR = ".page[data-page-number]";
/**
 * Pages pdf.js is showing: rendered (`data-loaded`), or being re-rendered
 * after a zoom, when it keeps the old canvas but drops `data-loaded`. Pages
 * far from the viewport are empty and match neither.
 */
const LIVE_PAGE_SELECTOR = `${PAGE_SELECTOR}:is([data-loaded="true"], :has(> .canvasWrapper))`;

/** The view type of Obsidian's PDF view. */
export const PDF_VIEW_TYPE = "pdf";

/**
 * The pages that should carry an overlay. pdf.js keeps only pages near the
 * viewport rendered; when it resets a page (zoom, rotation, recycling) it
 * removes every child it does not own, our layer included, so layers have to
 * be put back (see `OverlayController`).
 */
export function findLivePages(container: HTMLElement): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>(LIVE_PAGE_SELECTOR));
}

/** 1-based page number of a page element. */
export function getPageNumber(pageEl: HTMLElement): number | null {
	const value = Number.parseInt(pageEl.getAttribute("data-page-number") ?? "", 10);
	return Number.isInteger(value) && value > 0 ? value : null;
}

/** Height over width of a page as displayed; independent of zoom. */
export function getPageAspect(pageEl: HTMLElement): number {
	const width = pageEl.clientWidth;
	const height = pageEl.clientHeight;
	return width > 0 && height > 0 ? height / width : 1.294;
}

/** Where our toolbar button goes: the right end of the PDF toolbar. */
export function findToolbarHost(container: HTMLElement): HTMLElement | null {
	return (
		container.querySelector<HTMLElement>(".pdf-toolbar .pdf-toolbar-right") ??
		container.querySelector<HTMLElement>(".pdf-toolbar")
	);
}
