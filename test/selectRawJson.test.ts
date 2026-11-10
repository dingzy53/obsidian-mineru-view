import { describe, expect, it } from "vitest";
import { isMiddleJson, orderJsonCandidates } from "../src/mineru/selectRawJson";
import { ATTENTION, BERT, STRUCTURED, loadFixture } from "./fixtures";

describe("orderJsonCandidates", () => {
	it("prefers middle_json.json and never offers structured_content.json", () => {
		expect(
			orderJsonCandidates(["structured_content.json", "markdown.md", "paper.json", "middle_json.json", "a.json"]),
		).toEqual(["middle_json.json", "a.json", "paper.json"]);
	});

	it("matches names case-insensitively", () => {
		expect(orderJsonCandidates(["Structured_Content.JSON", "Middle_Json.json", "b.JSON"])).toEqual([
			"Middle_Json.json",
			"b.JSON",
		]);
	});

	it("returns nothing when there is no JSON", () => {
		expect(orderJsonCandidates(["markdown.md", "images"])).toEqual([]);
	});
});

describe("isMiddleJson", () => {
	it("accepts the docvortex middle fixtures", () => {
		expect(isMiddleJson(loadFixture(ATTENTION))).toBe(true);
		expect(isMiddleJson(loadFixture(BERT))).toBe(true);
	});

	it("rejects structured_content.json, which has pages and bboxes but no schema", () => {
		expect(isMiddleJson(loadFixture(STRUCTURED))).toBe(false);
	});

	it("accepts legacy pdf_info results with geometry", () => {
		expect(isMiddleJson({ pdf_info: [{ para_blocks: [{ bbox: [0, 0, 1, 1] }] }] })).toBe(true);
		expect(isMiddleJson({ pdf_info: [{ para_blocks: [] }] })).toBe(false);
	});

	it("rejects other JSON", () => {
		expect(isMiddleJson(null)).toBe(false);
		expect(isMiddleJson([])).toBe(false);
		expect(isMiddleJson({ schema: "docvortex.content", pages: [] })).toBe(false);
		expect(isMiddleJson({ schema: "docvortex.middle" })).toBe(false);
	});
});
