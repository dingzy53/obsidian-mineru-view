import { readFileSync } from "node:fs";
import { join } from "node:path";

/** MinerU 3.4.4 output for two public arXiv papers (1706.03762, 1810.04805). */
export function loadFixture(name: string): unknown {
	return JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8"));
}

export const ATTENTION = "attention.middle.json";
export const BERT = "bert.middle.json";
export const STRUCTURED = "attention.structured_content.json";
