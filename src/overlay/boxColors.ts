/*
 * Ported from mineru-for-zotero (src/modules/readerOverlay/boxColors.ts), AGPL-3.0-or-later.
 * Copyright (C) Asianfleet; Copyright (C) 2026 Ding Zheng Yuan.
 * https://github.com/dingzy53/mineru-for-zotero
 */
/**
 * Type color palette from MinerU official layout.pdf (docvortex.visualization._BLOCK_COLORS).
 *
 * Includes both normalized types and official raw types, ensuring both Middle JSON 2.0 and legacy
 * `pdf_info` results match the same color set. Colors are 0-1 float RGB, kept consistent with official values for proofreading.
 */
export type BoxColorTuple = readonly [number, number, number];

/** Fallback color when official types are not covered, corresponding to docvortex's (0.90, 0.10, 0.10). */
export const BOX_FALLBACK_COLOR: BoxColorTuple = [0.9, 0.1, 0.1];

const PAGE_AUXILIARY_GRAY: BoxColorTuple = [158 / 255, 158 / 255, 158 / 255];

export const BOX_TYPE_COLORS: Record<string, BoxColorTuple> = {
	text: [0.6, 0.05, 0.3],
	paragraph: [0.6, 0.05, 0.3],
	doc_title: [0.2, 0.2, 0.8],
	title: [0.2, 0.2, 0.8],
	paragraph_title: [0.2, 0.4, 0.9],
	ref_text: [0.45, 0.2, 0.65],
	reference: [0.45, 0.2, 0.65],
	citation: [0.45, 0.2, 0.65],
	bibliography: [0.45, 0.2, 0.65],
	equation: [0.0, 0.6, 0.1],
	formula: [0.0, 0.6, 0.1],
	interline_equation: [0.0, 0.6, 0.1],
	equation_interline: [0.0, 0.6, 0.1],
	inline_equation: [0.0, 0.6, 0.1],
	equation_inline: [0.0, 0.6, 0.1],
	list: [0.1, 0.6, 0.35],
	index: [0.1, 0.6, 0.35],
	image: [0.85, 0.35, 0.1],
	figure: [0.85, 0.35, 0.1],
	image_body: [0.85, 0.35, 0.1],
	image_caption: [0.8, 0.25, 0.55],
	image_footnote: [0.65, 0.35, 0.05],
	table: [0.8, 0.8, 0.0],
	table_body: [0.8, 0.8, 0.0],
	table_caption: [1.0, 0.85, 0.1],
	table_footnote: [0.55, 0.9, 0.25],
	chart: [0.85, 0.35, 0.1],
	chart_body: [0.85, 0.35, 0.1],
	chart_caption: [0.8, 0.25, 0.55],
	chart_footnote: [0.65, 0.35, 0.05],
	code: [0.4, 0.0, 0.8],
	code_body: [0.4, 0.0, 0.8],
	algorithm: [0.4, 0.0, 0.8],
	algorithm_body: [0.4, 0.0, 0.8],
	code_caption: [0.7, 0.35, 0.95],
	code_footnote: [0.85, 0.7, 0.95],
	page_footnote: [0.0, 128 / 255, 128 / 255],
	footnote: [0.0, 128 / 255, 128 / 255],
	page_header: PAGE_AUXILIARY_GRAY,
	header: PAGE_AUXILIARY_GRAY,
	page_footer: PAGE_AUXILIARY_GRAY,
	footer: PAGE_AUXILIARY_GRAY,
	page_number: PAGE_AUXILIARY_GRAY,
	aside_text: PAGE_AUXILIARY_GRAY,
	page_aside_text: PAGE_AUXILIARY_GRAY,
	phonetic: PAGE_AUXILIARY_GRAY,
	unknown: PAGE_AUXILIARY_GRAY,
};

/** Resolves the official color palette corresponding to the type, falling back to red for unknown types. */
export function getBoxColorTuple(type: string): BoxColorTuple {
	const normalized = normalizeColorType(type);
	return BOX_TYPE_COLORS[normalized] ?? BOX_FALLBACK_COLOR;
}

/** Generates solid border color corresponding to the type. */
export function getBoxColor(type: string): string {
	const [red, green, blue] = toRgbChannels(getBoxColorTuple(type));
	return `rgb(${red}, ${green}, ${blue})`;
}

/** Converts 0-1 float RGB to 0-255 integer channels. */
export function toRgbChannels(tuple: BoxColorTuple): [number, number, number] {
	return [
		channelToByte(tuple[0]),
		channelToByte(tuple[1]),
		channelToByte(tuple[2]),
	];
}

function channelToByte(value: number): number {
	const clamped = Math.max(0, Math.min(1, value));
	return Math.round(clamped * 255);
}

function normalizeColorType(type: string): string {
	return String(type ?? "")
		.trim()
		.toLowerCase();
}

/**
 * The static rules for `styles.css`: one `--mineru-box-rgb` per type, on both
 * boxes and legend swatches. `test/boxColors.test.ts` checks that styles.css
 * carries exactly this block, so the palette has a single source.
 */
export function createBoxTypeColorCss(): string {
	const byColor = new Map<string, string[]>();
	for (const type of Object.keys(BOX_TYPE_COLORS)) {
		const rgb = toRgbChannels(getBoxColorTuple(type)).join(", ");
		const types = byColor.get(rgb);
		if (types) types.push(type);
		else byColor.set(rgb, [type]);
	}
	return [...byColor]
		.map(([rgb, types]) => {
			const selector = types.map((type) => `[data-mineru-box-type="${type}"]`).join(",\n");
			return `${selector} {\n\t--mineru-box-rgb: ${rgb};\n}`;
		})
		.join("\n");
}
