/*
 * Adapted from mineru-for-zotero (src/modules/mineruClient/result.ts,
 * `hasPageBoxData`), AGPL-3.0-or-later.
 * Copyright (C) Asianfleet; Copyright (C) 2026 Ding Zheng Yuan.
 */

/** The preferred file name of MinerU's middle JSON in a result folder. */
export const MIDDLE_JSON_NAME = "middle_json.json";

/**
 * Never a layout source. `structured_content.json` also has
 * `pages[].blocks[].bbox` but no `schema`, so the legacy path would divide its
 * already-normalized bboxes by the page width and draw garbage.
 */
const EXCLUDED_NAMES = new Set(["structured_content.json"]);

/**
 * The `.json` files of a result folder worth trying, best first:
 * `middle_json.json`, then every other `.json` in name order.
 */
export function orderJsonCandidates(fileNames: readonly string[]): string[] {
	const candidates = fileNames
		.filter((name) => name.toLowerCase().endsWith(".json"))
		.filter((name) => !EXCLUDED_NAMES.has(name.toLowerCase()))
		.sort((a, b) => a.localeCompare(b));
	const preferred = candidates.filter((name) => name.toLowerCase() === MIDDLE_JSON_NAME);
	const others = candidates.filter((name) => name.toLowerCase() !== MIDDLE_JSON_NAME);
	return [...preferred, ...others];
}

/**
 * Whether parsed JSON is a MinerU middle JSON the box normalizer understands:
 * the docvortex schema (MinerU 3.x, normalized bboxes) or the legacy
 * `pdf_info[]` layout (bboxes in page units, with a page size).
 */
export function isMiddleJson(value: unknown): boolean {
	if (!value || typeof value !== "object") return false;
	const raw = value as { schema?: unknown; pages?: unknown; pdf_info?: unknown };
	if (typeof raw.schema === "string" && raw.schema.toLowerCase().startsWith("docvortex.middle")) {
		return Array.isArray(raw.pages);
	}
	return Array.isArray(raw.pdf_info) && hasPageBoxData(raw.pdf_info);
}

function hasPageBoxData(pages: unknown[]): boolean {
	return pages.some((page) => {
		if (!page || typeof page !== "object") return false;
		const rawPage = page as { blocks?: unknown; para_blocks?: unknown; layout_dets?: unknown };
		return [rawPage.blocks, rawPage.para_blocks, rawPage.layout_dets].some(
			(blocks) => Array.isArray(blocks) && blocks.some(hasBlockGeometry),
		);
	});
}

function hasBlockGeometry(value: unknown): boolean {
	const block = value as { bbox?: unknown; poly?: unknown } | null;
	return (
		(Array.isArray(block?.bbox) && block.bbox.length >= 4) ||
		(Array.isArray(block?.poly) && block.poly.length >= 4)
	);
}
