import { describe, expect, it } from "vitest";
import {
	cleanFolderPath,
	resultFolderFor,
	resultFolderOfPath,
	resultImagePath,
	validateResultsFolder,
} from "../src/results/paths";

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
