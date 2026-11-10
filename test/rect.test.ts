import { describe, expect, it } from "vitest";
import { buildFileEmbed, buildRegionEmbed, buildRegionLink } from "../src/copy/links";
import { normalizedBoxToPdfRect } from "../src/pdf/rect";

describe("normalizedBoxToPdfRect", () => {
	it("flips y on a US Letter page", () => {
		// Left quarter to half across, 10% to 30% down.
		expect(normalizedBoxToPdfRect({ x: 0.25, y: 0.1, width: 0.25, height: 0.2 }, [0, 0, 612, 792])).toEqual([
			153, 554, 306, 713,
		]);
	});

	it("covers the page for the full box", () => {
		expect(normalizedBoxToPdfRect({ x: 0, y: 0, width: 1, height: 1 }, [0, 0, 612, 792])).toEqual([0, 0, 612, 792]);
	});

	it("honours a view box with a non-zero origin", () => {
		expect(normalizedBoxToPdfRect({ x: 0.5, y: 0, width: 0.5, height: 0.5 }, [10, 20, 210, 420])).toEqual([
			110, 220, 210, 420,
		]);
	});
});

describe("link builders", () => {
	it("builds a region link and embed", () => {
		expect(buildRegionLink("paper.pdf", 3, [153, 554, 306, 713], "Table p.3")).toBe(
			"[[paper.pdf#page=3&rect=153,554,306,713|Table p.3]]",
		);
		expect(buildRegionEmbed("Papers/paper.pdf", 3, [153, 554, 306, 713])).toBe(
			"![[Papers/paper.pdf#page=3&rect=153,554,306,713]]",
		);
	});

	it("keeps brackets and pipes out of the alias", () => {
		expect(buildRegionLink("a.pdf", 1, [0, 0, 1, 1], "x|y [z]")).toBe("[[a.pdf#page=1&rect=0,0,1,1|x y z]]");
	});

	it("builds an image embed", () => {
		expect(buildFileEmbed("MinerU/paper/images/page_2_image_0.jpg")).toBe(
			"![[MinerU/paper/images/page_2_image_0.jpg]]",
		);
	});
});
