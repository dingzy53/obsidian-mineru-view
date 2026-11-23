import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOX_FALLBACK_COLOR, createBoxTypeColorCss, getBoxColor, toRgbChannels } from "../src/overlay/boxColors";

describe("box colors", () => {
	it("uses MinerU's palette", () => {
		expect(getBoxColor("text")).toBe("rgb(153, 13, 77)");
		expect(getBoxColor(" Table ")).toBe("rgb(204, 204, 0)");
		expect(getBoxColor("never_seen")).toBe("rgb(230, 26, 26)");
		expect(toRgbChannels(BOX_FALLBACK_COLOR)).toEqual([230, 26, 26]);
	});

	it("is what styles.css carries", () => {
		const css = readFileSync(join(__dirname, "..", "styles.css"), "utf8");
		const block = /\/\* BEGIN type colors \*\/\n([\s\S]*?)\n\/\* END type colors \*\//.exec(css);
		expect(block?.[1]).toBe(createBoxTypeColorCss());
		// The fallback of styles.css is the palette's fallback color.
		expect(css).toContain(`--mineru-box-rgb: ${toRgbChannels(BOX_FALLBACK_COLOR).join(", ")};`);
	});

	it("keeps Formula/Image and Heading/Image-caption swatch colors distinct", () => {
		expect(getBoxColor("equation")).not.toBe(getBoxColor("image"));
		expect(getBoxColor("paragraph_title")).not.toBe(getBoxColor("image_caption"));
		expect(getBoxColor("image")).not.toBe(getBoxColor("image_footnote"));
	});
});
