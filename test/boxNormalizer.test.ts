import { describe, expect, it } from "vitest";
import { normalizeMinerUBoxes } from "../src/mineru/boxNormalizer";
import type { NormalizedBox } from "../src/mineru/domain";
import { ATTENTION, BERT, loadFixture } from "./fixtures";

function countByType(boxes: NormalizedBox[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const box of boxes) counts[box.type] = (counts[box.type] ?? 0) + 1;
	return counts;
}

const attention = normalizeMinerUBoxes(loadFixture(ATTENTION));
const bert = normalizeMinerUBoxes(loadFixture(BERT));
const all = [...attention, ...bert];

describe("normalizeMinerUBoxes on the docvortex 2.0 fixtures", () => {
	it("produces the surveyed number of boxes per type", () => {
		expect(countByType(attention)).toEqual({
			text: 78,
			ref_text: 40,
			paragraph_title: 24,
			page_number: 14,
			page_footnote: 7,
			equation: 5,
			table: 4,
			table_caption: 4,
			image: 3,
			image_caption: 3,
			chart: 2,
			chart_caption: 3,
			doc_title: 1,
			aside_text: 1,
			footer: 1,
		});
		expect(countByType(bert)).toEqual({
			text: 144,
			ref_text: 48,
			paragraph_title: 32,
			page_footnote: 15,
			table: 8,
			table_caption: 8,
			image: 7,
			image_caption: 7,
			doc_title: 1,
			aside_text: 1,
			code: 1,
			chart: 1,
			chart_caption: 1,
		});
		const total = countByType(all);
		expect(total.text).toBe(222);
		expect(total.ref_text).toBe(88);
		expect(total.paragraph_title).toBe(56);
	});

	it("numbers pages from 1", () => {
		expect(Math.min(...attention.map((box) => box.page))).toBe(1);
		expect(Math.max(...attention.map((box) => box.page))).toBe(15);
		expect(Math.min(...bert.map((box) => box.page))).toBe(1);
		expect(Math.max(...bert.map((box) => box.page))).toBe(16);
	});

	it("keeps every bbox within the page", () => {
		for (const { bbox } of all) {
			for (const value of [bbox.x, bbox.y, bbox.width, bbox.height]) {
				expect(value).toBeGreaterThanOrEqual(0);
				expect(value).toBeLessThanOrEqual(1);
			}
			expect(bbox.width).toBeGreaterThan(0);
			expect(bbox.height).toBeGreaterThan(0);
			expect(bbox.x + bbox.width).toBeLessThanOrEqual(1 + 1e-9);
			expect(bbox.y + bbox.height).toBeLessThanOrEqual(1 + 1e-9);
		}
	});

	it("gives visual containers their image path when MinerU saved images", () => {
		const isContainer = (box: NormalizedBox) => ["image", "table", "chart", "code"].includes(box.type);
		const containers = attention.filter(isContainer);
		expect(containers.length).toBe(9);
		for (const box of containers) {
			expect(box.imagePath, `${box.type} on page ${box.page}`).toMatch(/^images\/page_\d+_[a-z]+_\d+\.jpg$/);
		}
		expect(attention.find((box) => box.type === "image")?.imagePath).toBe("images/page_2_image_0.jpg");
		// The bert JSON omits image_path (see candidateBoxImagePaths).
		expect(bert.filter(isContainer).length).toBe(17);
		expect(bert.some((box) => box.imagePath)).toBe(false);
	});

	it("labels boxes with MinerU's per-page index, 1-based and unique per page", () => {
		const firstPage = attention.filter((box) => box.page === 1);
		expect(firstPage.map((box) => box.pageIndexLabel)).toEqual(firstPage.map((_, i) => i + 1));
		expect(firstPage[1].type).toBe("doc_title");
		expect(firstPage[1].pageIndexLabel).toBe(2);

		const byPage = new Map<number, number[]>();
		for (const box of attention) byPage.set(box.page, [...(byPage.get(box.page) ?? []), box.pageIndexLabel]);
		for (const [page, labels] of byPage) {
			expect(new Set(labels).size, `page ${page}`).toBe(labels.length);
		}
	});

	it("keeps captions apart from the container's content", () => {
		const image = attention.find((box) => box.type === "image");
		const caption = attention.find((box) => box.type === "image_caption");
		expect(image?.markdown).toBe("");
		expect(caption?.markdown).toBe("Figure 1: The Transformer - model architecture.");
		expect(caption?.pageIndexLabel).toBe((image?.pageIndexLabel ?? 0) + 1);

		const table = attention.find((box) => box.type === "table");
		expect(table?.tableFormats?.html).toMatch(/^<table>.*<\/table>$/s);
		expect(table?.tableFormats?.markdown).toBeUndefined();
	});

	it("extracts formulas and inline maths", () => {
		const equation = attention.find((box) => box.type === "equation");
		expect(equation?.formula).toContain("\\operatorname{Attention}");
		const inline = attention.find((box) => box.type === "text" && /\$[^$]+\$/.test(box.markdown));
		expect(inline).toBeDefined();
	});
});

describe("normalizeMinerUBoxes on legacy pdf_info results", () => {
	it("divides bboxes by the page size", () => {
		const boxes = normalizeMinerUBoxes({
			pdf_info: [
				{
					page_idx: 2,
					page_size: [600, 800],
					para_blocks: [
						{ type: "text", index: 4, bbox: [60, 80, 300, 400], lines: [{ spans: [{ content: "Hello" }] }] },
						{ type: "interline_equation", bbox: [0, 0, 600, 800], lines: [{ spans: [{ content: "E=mc^2" }] }] },
					],
				},
			],
		});
		expect(boxes).toHaveLength(2);
		expect(boxes[0]).toMatchObject({
			page: 3,
			type: "text",
			markdown: "Hello",
			bbox: { x: 0.1, y: 0.1, width: 0.4, height: 0.4 },
		});
		// One box lacks an index, so the page is numbered by position.
		expect(boxes.map((box) => box.pageIndexLabel)).toEqual([1, 2]);
		expect(boxes[1].formula).toBe("E=mc^2");
	});

	it("takes an image path from an inline Markdown or HTML image link", () => {
		const page = (blocks: unknown[]) => ({ pdf_info: [{ page_idx: 0, page_size: [100, 100], para_blocks: blocks }] });
		const [markdown, html, dataUri, remote, dotted] = normalizeMinerUBoxes(
			page([
				{ type: "image", index: 0, bbox: [0, 0, 10, 10], markdown: "![](images/page_0_image_0.jpg)" },
				{ type: "table", index: 1, bbox: [0, 0, 10, 10], markdown: '<img src="images/a b.png" alt="">' },
				{ type: "image", index: 2, bbox: [0, 0, 10, 10], markdown: "![](data:image/png;base64,AAAA)" },
				{ type: "image", index: 3, bbox: [0, 0, 10, 10], markdown: "![](https://example.com/x.png)" },
				{ type: "image", index: 4, bbox: [0, 0, 10, 10], markdown: "![fig](./images/fig%201.jpg)" },
			]),
		);
		expect(markdown.imagePath).toBe("images/page_0_image_0.jpg");
		expect(html.imagePath).toBe("images/a b.png");
		expect(dataUri.imagePath).toBeUndefined();
		expect(remote.imagePath).toBeUndefined();
		expect(dotted.imagePath).toBe("images/fig 1.jpg");
	});

	it("prefers image_path over an inline image link", () => {
		const [box] = normalizeMinerUBoxes({
			pdf_info: [
				{
					page_idx: 0,
					page_size: [100, 100],
					para_blocks: [
						{ type: "image", bbox: [0, 0, 10, 10], image_path: "images/own.jpg", markdown: "![](images/other.jpg)" },
					],
				},
			],
		});
		expect(box.imagePath).toBe("images/own.jpg");
	});

	it("returns nothing for junk", () => {
		expect(normalizeMinerUBoxes({})).toEqual([]);
		expect(normalizeMinerUBoxes({ pages: "nope" })).toEqual([]);
	});

	it("keeps page badges unique when docvortex 2.0 containers use local child indices (BUG-07)", () => {
		const boxes = normalizeMinerUBoxes({
			schema: "docvortex.middle.2.0",
			pages: [
				{
					page_idx: 0,
					blocks: [
						{ type: "text", index: 0, bbox: [0.1, 0.1, 0.9, 0.2], content: "Intro" },
						{ type: "text", index: 1, bbox: [0.1, 0.2, 0.9, 0.3], content: "Body" },
						{
							type: "image",
							index: 2,
							bbox: [0.1, 0.4, 0.9, 0.7],
							content: [
								{ type: "image_body", index: 0, bbox: [0.1, 0.4, 0.9, 0.65], image_path: "images/fig.png" },
								{ type: "image_caption", index: 1, bbox: [0.1, 0.65, 0.9, 0.7], content: "Figure 1" },
							],
						},
					],
				},
			],
		});
		expect(boxes.map((b) => [b.type, b.pageIndexLabel])).toEqual([
			["text", 1],
			["text", 2],
			["image", 3],
			["image_caption", 4],
		]);
	});
});
