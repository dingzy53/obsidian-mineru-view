import type { NormalizedBox } from "../mineru/domain";
import { formatBoxTypeLabel, sortByReadingOrder } from "./boxes";

export const LAYER_CLASS = "mineru-page-layer";
const BOX_INDEX_ATTR = "data-mineru-box-index";

/** What a page layer looks like; changing any of it rebuilds the layers. */
export interface LayerOptions {
	mode: "all" | "hover";
	showBadges: boolean;
	showArrows: boolean;
	hiddenTypes: ReadonlySet<string>;
	fillOpacity: number;
	/** Height over width of the page, for the arrow drawing. */
	aspect: number;
}

/** Percentage with at most four decimals, e.g. `12.3457%`. */
function percent(value: number): string {
	return `${Number((value * 100).toFixed(4))}%`;
}

/**
 * Builds the overlay of one page and appends it to the page element. Boxes are
 * positioned in percentages of the page, so the layer follows zoom without
 * being rebuilt. Only the boxes take pointer events; everywhere else the
 * viewer keeps wheel, selection and clicks.
 */
export function buildPageLayer(pageEl: HTMLElement, boxes: NormalizedBox[], options: LayerOptions): HTMLElement {
	const layer = pageEl.createDiv({ cls: [LAYER_CLASS, `mineru-mode-${options.mode}`] });
	layer.setCssProps({ "--mineru-fill-alpha": String(options.fillOpacity) });
	layer.toggleClass("mineru-hide-badges", !options.showBadges);

	const visible = boxes.filter((box) => !options.hiddenTypes.has(box.type));
	if (options.showArrows) drawArrows(layer, sortByReadingOrder(visible), options.aspect);

	// Largest first, so a small box inside a large one stays reachable.
	const byArea = [...visible].sort((a, b) => b.bbox.width * b.bbox.height - a.bbox.width * a.bbox.height);
	for (const box of byArea) {
		const boxEl = layer.createDiv({
			cls: "mineru-box",
			attr: { "data-mineru-box-type": box.type, [BOX_INDEX_ATTR]: String(box.rawIndex) },
		});
		boxEl.setCssProps({
			"--mineru-x": percent(box.bbox.x),
			"--mineru-y": percent(box.bbox.y),
			"--mineru-w": percent(box.bbox.width),
			"--mineru-h": percent(box.bbox.height),
		});
		boxEl.createSpan({ cls: "mineru-box-index", text: String(box.pageIndexLabel), attr: { "aria-hidden": "true" } });
		boxEl.createSpan({ cls: "mineru-box-label", text: formatBoxTypeLabel(box.type) });
	}
	return layer;
}

/** The box a pointer event landed on, by its position in the result. */
export function getBoxIndexFromEvent(event: Event): number | null {
	const target = event.target;
	if (!target || !(target as Node).instanceOf(Element)) return null;
	const boxEl = (target as Element).closest(`[${BOX_INDEX_ATTR}]`);
	const value = Number.parseInt(boxEl?.getAttribute(BOX_INDEX_ATTR) ?? "", 10);
	return Number.isInteger(value) ? value : null;
}

/** Width of the arrow drawing's coordinate system; its height is `ARROW_UNITS * aspect`. */
const ARROW_UNITS = 1000;
const ARROW_HEAD = 9;

/** One polyline through the box centres in reading order, with a head at each stop. */
function drawArrows(layer: HTMLElement, ordered: NormalizedBox[], aspect: number): void {
	if (ordered.length < 2) return;
	const height = ARROW_UNITS * aspect;
	const points = ordered.map((box) => ({
		x: (box.bbox.x + box.bbox.width / 2) * ARROW_UNITS,
		y: (box.bbox.y + box.bbox.height / 2) * height,
	}));

	const lines: string[] = [];
	const heads: string[] = [];
	for (let i = 1; i < points.length; i++) {
		const from = points[i - 1];
		const to = points[i];
		const length = Math.hypot(to.x - from.x, to.y - from.y);
		if (length < 1) continue;
		lines.push(`M${fmt(from.x)} ${fmt(from.y)}L${fmt(to.x)} ${fmt(to.y)}`);
		// Unit vector along the segment and its normal.
		const ux = (to.x - from.x) / length;
		const uy = (to.y - from.y) / length;
		const bx = to.x - ux * ARROW_HEAD;
		const by = to.y - uy * ARROW_HEAD;
		const half = ARROW_HEAD * 0.45;
		heads.push(
			`M${fmt(to.x)} ${fmt(to.y)}L${fmt(bx - uy * half)} ${fmt(by + ux * half)}L${fmt(bx + uy * half)} ${fmt(by - ux * half)}Z`,
		);
	}

	const svg = layer.createSvg("svg", {
		cls: "mineru-arrows",
		attr: { viewBox: `0 0 ${ARROW_UNITS} ${fmt(height)}`, preserveAspectRatio: "none", "aria-hidden": "true" },
	});
	svg.createSvg("path", { cls: "mineru-arrow-lines", attr: { d: lines.join("") } });
	svg.createSvg("path", { cls: "mineru-arrow-heads", attr: { d: heads.join("") } });
	const start = points[0];
	svg.createSvg("circle", { cls: "mineru-arrow-start", attr: { cx: fmt(start.x), cy: fmt(start.y), r: "4" } });
}

function fmt(value: number): string {
	return String(Number(value.toFixed(1)));
}
