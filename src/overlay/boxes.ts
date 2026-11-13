/*
 * Ported from mineru-for-zotero (src/modules/readerOverlay/render.ts),
 * AGPL-3.0-or-later.
 * Copyright (C) Asianfleet; Copyright (C) 2026 Ding Zheng Yuan.
 */
import type { NormalizedBox } from "../mineru/domain";

/** Groups boxes by page, pages ascending. */
export function groupBoxesByPage(boxes: NormalizedBox[]): Map<number, NormalizedBox[]> {
	const pages = new Map<number, NormalizedBox[]>();
	for (const box of boxes) {
		const page = Number.isFinite(box.page) ? box.page : 1;
		const pageBoxes = pages.get(page);
		if (pageBoxes) pageBoxes.push(box);
		else pages.set(page, [box]);
	}
	return new Map([...pages].sort(([a], [b]) => a - b));
}

/** The boxes of one page worth drawing. */
export function getRenderablePageBoxes(boxes: NormalizedBox[]): NormalizedBox[] {
	return boxes.filter((box) => !isStructuralReferenceContainerBox(box, boxes));
}

/** Whether a list box is merely a structural wrapper around reference boxes. */
function isStructuralReferenceContainerBox(box: NormalizedBox, boxes: NormalizedBox[]): boolean {
	return (
		normalizeBoxType(box.type) === "list" &&
		boxes.some(
			(candidate) => candidate !== box && isReferenceBoxType(candidate.type) && containsBox(box, candidate),
		)
	);
}

/** Whether `child` lies completely inside `container`. */
export function containsBox(container: NormalizedBox, child: NormalizedBox): boolean {
	if (container.page !== child.page) return false;

	const epsilon = 0.0001;
	const containerRight = container.bbox.x + container.bbox.width;
	const containerBottom = container.bbox.y + container.bbox.height;
	const childRight = child.bbox.x + child.bbox.width;
	const childBottom = child.bbox.y + child.bbox.height;

	return (
		child.bbox.x + epsilon >= container.bbox.x &&
		child.bbox.y + epsilon >= container.bbox.y &&
		childRight <= containerRight + epsilon &&
		childBottom <= containerBottom + epsilon
	);
}

/**
 * The box under a point of the page, in normalized coordinates (0–1, origin
 * top left). Where boxes overlap, the smallest wins, so a caption or formula
 * inside a larger box stays reachable. Edges count as inside.
 */
export function findBoxAt(boxes: readonly NormalizedBox[], x: number, y: number): NormalizedBox | null {
	let best: NormalizedBox | null = null;
	let bestArea = Infinity;
	for (const box of boxes) {
		const { bbox } = box;
		if (x < bbox.x || y < bbox.y || x > bbox.x + bbox.width || y > bbox.y + bbox.height) continue;
		const area = bbox.width * bbox.height;
		if (area < bestArea) {
			best = box;
			bestArea = area;
		}
	}
	return best;
}

/** The boxes of a page in reading order (badge number, then document order). */
export function sortByReadingOrder(boxes: NormalizedBox[]): NormalizedBox[] {
	return [...boxes].sort((a, b) => a.pageIndexLabel - b.pageIndexLabel || a.rawIndex - b.rawIndex);
}

const TYPE_LABELS: Record<string, string> = {
	text: "Text",
	paragraph: "Text",
	doc_title: "Title",
	title: "Title",
	paragraph_title: "Heading",
	list: "List",
	table: "Table",
	table_body: "Table",
	chart: "Chart",
	chart_body: "Chart",
	figure: "Image",
	image: "Image",
	image_body: "Image",
	image_caption: "Image caption",
	table_caption: "Table caption",
	chart_caption: "Chart caption",
	image_footnote: "Image footnote",
	table_footnote: "Table footnote",
	chart_footnote: "Chart footnote",
	page_header: "Header",
	header: "Header",
	page_footer: "Footer",
	footer: "Footer",
	page_footnote: "Footnote",
	footnote: "Footnote",
	page_number: "Page number",
	ref_text: "Reference",
	reference: "Reference",
	citation: "Reference",
	bibliography: "Reference",
	formula: "Formula",
	interline_equation: "Formula",
	equation_interline: "Formula",
	inline_equation: "Formula",
	equation_inline: "Formula",
	equation: "Formula",
	index: "Index",
	phonetic: "Phonetic",
	code: "Code",
	algorithm: "Algorithm",
	code_caption: "Code caption",
	code_body: "Code",
	code_footnote: "Code footnote",
	aside_text: "Aside",
	page_aside_text: "Aside",
	unknown: "Unknown",
};

/** A display label for a box type; unknown types show as they are. */
export function formatBoxTypeLabel(type: string): string {
	const normalized = normalizeBoxType(type);
	return TYPE_LABELS[normalized] ?? normalized;
}

export function isReferenceBoxType(type: string): boolean {
	return ["ref_text", "reference", "citation", "bibliography"].includes(normalizeBoxType(type));
}

export function isFormulaBoxType(type: string): boolean {
	return [
		"formula",
		"interline_equation",
		"equation_interline",
		"inline_equation",
		"equation_inline",
		"equation",
	].includes(normalizeBoxType(type));
}

export function isTableBoxType(type: string): boolean {
	return ["table", "table_body"].includes(normalizeBoxType(type));
}

/** Types whose content is a picture rather than text. */
export function isVisualBoxType(type: string): boolean {
	return ["image", "image_body", "figure", "chart", "chart_body"].includes(normalizeBoxType(type));
}

export function normalizeBoxType(type: string): string {
	return type.trim().toLowerCase();
}

/** The block types present in a document, in order of first appearance. */
export function listBoxTypes(boxes: NormalizedBox[]): string[] {
	return [...new Set(boxes.map((box) => normalizeBoxType(box.type)))];
}
