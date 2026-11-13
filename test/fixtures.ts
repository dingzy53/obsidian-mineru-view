import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * MinerU 3.4.4 output for two arXiv papers (1706.03762, 1810.04805). The
 * layout (types, boxes, order, image paths), formulas and tables are real;
 * the prose is replaced by filler of the same length, except the Figure 1
 * caption. The structured_content fixture is synthetic, with the shape of
 * MinerU's: boxes but no `schema`.
 */
export function loadFixture(name: string): unknown {
	return JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8"));
}

export const ATTENTION = "attention.middle.json";
export const BERT = "bert.middle.json";
export const STRUCTURED = "attention.structured_content.json";
