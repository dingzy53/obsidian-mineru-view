import { describe, expect, it } from "vitest";
import { normalizeMinerUBoxes } from "../src/mineru/boxNormalizer";
import {
	candidateBoxImagePaths,
	cleanFolderPath,
	resultFolderFor,
	resultFolderOfPath,
	resultImagePath,
	validateResultsFolder,
} from "../src/results/paths";
import { BERT, loadFixture } from "./fixtures";

describe("result folder paths", () => {
	it("maps a PDF basename to <root>/<basename>", () => {
		expect(resultFolderFor("MinerU", "attention_is_all_you_need")).toBe("MinerU/attention_is_all_you_need");
		expect(resultFolderFor("/Parsed/MinerU/", "bert")).toBe("Parsed/MinerU/bert");
		expect(resultFolderFor("", "bert")).toBe("bert");
	});

	it("gives PDFs with the same basename the same folder", () => {
		// "a/paper.pdf" and "b/paper.pdf" both have basename "paper".
		expect(resultFolderFor("MinerU", "paper")).toBe(resultFolderFor("MinerU", "paper"));
	});

	it("cleans user-typed folders", () => {
		expect(cleanFolderPath(" \\MinerU\\out// ")).toBe("MinerU/out");
		expect(cleanFolderPath("./MinerU")).toBe("MinerU");
		expect(validateResultsFolder("MinerU/")).toBe("MinerU");
		expect(validateResultsFolder("")).toBe("");
		expect(validateResultsFolder("../outside")).toBeNull();
		expect(validateResultsFolder(42)).toBeNull();
	});

	it("finds the result folder a changed file belongs to", () => {
		expect(resultFolderOfPath("MinerU", "MinerU/bert/middle_json.json")).toBe("MinerU/bert");
		expect(resultFolderOfPath("MinerU", "MinerU/bert/images/a.jpg")).toBe("MinerU/bert");
		expect(resultFolderOfPath("MinerU", "MinerU/bert")).toBe("MinerU/bert");
		expect(resultFolderOfPath("MinerU", "MinerU")).toBe("MinerU");
		expect(resultFolderOfPath("MinerU", "Papers/bert.pdf")).toBeNull();
		expect(resultFolderOfPath("MinerU", "MinerUX/bert/a.json")).toBeNull();
		expect(resultFolderOfPath("", "bert/middle_json.json")).toBe("bert");
	});

	it("resolves image paths inside the result folder", () => {
		expect(resultImagePath("MinerU/paper", "images/page_2_image_0.jpg")).toBe(
			"MinerU/paper/images/page_2_image_0.jpg",
		);
	});
});

describe("candidate image paths of a box", () => {
	const fallback = (name: string) => ["jpg", "png", "jpeg", "webp"].map((ext) => `images/${name}.${ext}`);

	it("tries the box's own path first", () => {
		expect(candidateBoxImagePaths({ imagePath: "images/foo.jpg", page: 1, type: "text" })).toEqual(["images/foo.jpg"]);
		expect(candidateBoxImagePaths({ imagePath: "images/page_2_image_0.jpg", page: 3, type: "image", sourceIndex: 0 })).toEqual(
			["images/page_2_image_0.jpg", ...fallback("page_2_image_0").slice(1)],
		);
	});

	it("also looks under images/ for a bare file name", () => {
		expect(candidateBoxImagePaths({ imagePath: "foo.jpg", page: 1, type: "text" })).toEqual(["foo.jpg", "images/foo.jpg"]);
		expect(candidateBoxImagePaths({ imagePath: "page_0_image_0.png", page: 1, type: "image", sourceIndex: 0 })).toEqual([
			"page_0_image_0.png",
			"images/page_0_image_0.png",
			...fallback("page_0_image_0").filter((path) => path !== "images/page_0_image_0.png"),
		]);
	});

	it("falls back to MinerU's page_N_type_K naming", () => {
		expect(candidateBoxImagePaths({ page: 3, type: "image", sourceIndex: 0 })).toEqual(fallback("page_2_image_0"));
		expect(candidateBoxImagePaths({ imagePath: null, page: 6, type: "table", sourceIndex: 0 })).toEqual(
			fallback("page_5_table_0"),
		);
		expect(candidateBoxImagePaths({ page: 16, type: "chart", sourceIndex: 9 })).toEqual(fallback("page_15_chart_9"));
		expect(candidateBoxImagePaths({ page: 1, type: "figure", sourceIndex: 2 })).toEqual([
			...fallback("page_0_figure_2"),
			...fallback("page_0_image_2"),
		]);
	});

	it("has no fallback without an index, a page, or a cropped type", () => {
		expect(candidateBoxImagePaths({ page: 3, type: "image" })).toEqual([]);
		expect(candidateBoxImagePaths({ page: 0, type: "image", sourceIndex: 0 })).toEqual([]);
		expect(candidateBoxImagePaths({ page: 3, type: "text", sourceIndex: 0 })).toEqual([]);
		expect(candidateBoxImagePaths({ page: 3, type: "image_caption", sourceIndex: 1 })).toEqual([]);
	});

	it("ignores an own path that leaves the result folder", () => {
		expect(candidateBoxImagePaths({ imagePath: "../secret.jpg", page: 1, type: "text" })).toEqual([]);
	});

	it("finds the images of the bert result, whose JSON has no image_path", () => {
		const visual = normalizeMinerUBoxes(loadFixture(BERT)).filter((box) => ["image", "table", "chart"].includes(box.type));
		expect(visual).toHaveLength(16);
		const first = visual.map((box) => candidateBoxImagePaths(box)[0]);
		expect(first).toContain("images/page_2_image_0.jpg");
		expect(first).toContain("images/page_5_table_0.jpg");
		expect(first).toContain("images/page_15_chart_9.jpg");
		expect(first).toContain("images/page_15_table_12.jpg");
		for (const path of first) expect(path).toMatch(/^images\/page_\d+_(image|table|chart)_\d+\.jpg$/);
	});
});
