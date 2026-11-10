import type { PdfBox } from "../pdf/rect";

/** `#page=N&rect=x1,y1,x2,y2`, the subpath Obsidian's PDF viewer understands. */
export function buildRectSubpath(page: number, rect: PdfBox): string {
	return `#page=${page}&rect=${rect.join(",")}`;
}

/** `[[paper.pdf#page=3&rect=…|Table p.3]]` */
export function buildRegionLink(linktext: string, page: number, rect: PdfBox, label: string): string {
	return `[[${linktext}${buildRectSubpath(page, rect)}|${sanitizeAlias(label)}]]`;
}

/** `![[paper.pdf#page=3&rect=…]]` */
export function buildRegionEmbed(linktext: string, page: number, rect: PdfBox): string {
	return `![[${linktext}${buildRectSubpath(page, rect)}]]`;
}

/** `![[MinerU/paper/images/page_2_image_0.jpg]]` */
export function buildFileEmbed(linktext: string): string {
	return `![[${linktext}]]`;
}

/** Brackets and pipes would break `[[…|alias]]`. */
function sanitizeAlias(label: string): string {
	return label.replace(/[[\]|]/g, " ").replace(/\s+/g, " ").trim();
}
