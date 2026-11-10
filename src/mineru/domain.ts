/*
 * Ported from mineru-for-zotero (src/modules/domain.ts), AGPL-3.0-or-later.
 * Copyright (C) Asianfleet; Copyright (C) 2026 Ding Zheng Yuan.
 * https://github.com/dingzy53/mineru-for-zotero
 */

export type MinerUBoxType = string;

export interface NormalizedBox {
	/** Position in the normalized list (document order). */
	rawIndex: number;
	/**
	 * Original MinerU block index, 0-based within its page; the official
	 * layout.pdf shows it 1-based. Legacy results may lack it.
	 */
	sourceIndex?: number;
	/**
	 * The number shown in the box's badge: the per-page reading-order index,
	 * 1-based, matching MinerU's official layout.pdf.
	 */
	pageIndexLabel: number;
	/** 1-based page number. */
	page: number;
	type: MinerUBoxType;
	/** Normalized 0-1, origin at the top left of the page. */
	bbox: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	markdown: string;
	formula: string | null;
	/** Relative to the result folder, e.g. `images/page_2_image_0.jpg`. */
	imagePath?: string | null;
	tableFormats?: Partial<Record<TableCopyTextFormat, string>>;
}

export type OverlayMode = "all" | "hover" | "off";
export const OVERLAY_MODES: readonly OverlayMode[] = ["all", "hover", "off"];
export type FormulaCopyMode = "with-dollar" | "without-dollar";
export type TableCopyTextFormat = "latex" | "markdown" | "html" | "tsv";
