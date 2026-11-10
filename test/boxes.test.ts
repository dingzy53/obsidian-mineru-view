import { describe, expect, it } from "vitest";
import { normalizeMinerUBoxes } from "../src/mineru/boxNormalizer";
import {
	formatBoxTypeLabel,
	getRenderablePageBoxes,
	groupBoxesByPage,
	listBoxTypes,
	sortByReadingOrder,
} from "../src/overlay/boxes";
import { ATTENTION, loadFixture } from "./fixtures";

const boxes = normalizeMinerUBoxes(loadFixture(ATTENTION));

describe("box helpers", () => {
	it("groups by page in ascending order", () => {
		const pages = groupBoxesByPage(boxes);
		expect([...pages.keys()]).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
		expect(pages.get(1)).toHaveLength(17);
	});

	it("sorts a page into reading order", () => {
		const page = groupBoxesByPage(boxes).get(3) ?? [];
		const sorted = sortByReadingOrder([...page].reverse());
		expect(sorted.map((box) => box.pageIndexLabel)).toEqual(page.map((_, i) => i + 1));
	});

	it("drops a list box that only wraps references", () => {
		const list = { ...boxes[0], type: "list", bbox: { x: 0, y: 0, width: 1, height: 1 } };
		const reference = { ...boxes[0], type: "ref_text", bbox: { x: 0.1, y: 0.1, width: 0.5, height: 0.1 } };
		expect(getRenderablePageBoxes([list, reference])).toEqual([reference]);
		expect(getRenderablePageBoxes([list, boxes[0]])).toHaveLength(2);
	});

	it("labels types", () => {
		expect(formatBoxTypeLabel("paragraph_title")).toBe("Heading");
		expect(formatBoxTypeLabel("ref_text")).toBe("Reference");
		expect(formatBoxTypeLabel("Equation ")).toBe("Formula");
		expect(formatBoxTypeLabel("brand_new")).toBe("brand_new");
	});

	it("lists the types present, first appearance first", () => {
		expect(listBoxTypes(boxes).slice(0, 3)).toEqual(["text", "doc_title", "paragraph_title"]);
		expect(listBoxTypes(boxes)).toHaveLength(15);
	});
});
