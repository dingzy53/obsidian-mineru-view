import { describe, expect, it } from "vitest";
import { formatBoxForCopy, formatFormulaBoxForCopy, formatTableBoxForCopy } from "../src/copy/copyFormatter";
import { normalizeMinerUBoxes } from "../src/mineru/boxNormalizer";
import type { NormalizedBox } from "../src/mineru/domain";
import { ATTENTION, loadFixture } from "./fixtures";

function box(partial: Partial<NormalizedBox>): NormalizedBox {
	return {
		rawIndex: 0,
		pageIndexLabel: 1,
		page: 1,
		type: "text",
		bbox: { x: 0, y: 0, width: 1, height: 1 },
		markdown: "",
		formula: null,
		...partial,
	};
}

const TABLE = '<table><tr><td>Model</td><td>BLEU</td></tr><tr><td>A &amp; B</td><td><eq>d_{model} \\cdot 2</eq> | 5%</td></tr></table>';

describe("formulas", () => {
	it("wraps a display formula in $$", () => {
		const equation = box({ type: "equation", markdown: "E=mc^2", formula: "E=mc^2" });
		expect(formatBoxForCopy(equation)).toBe("$$\nE=mc^2\n$$");
		expect(formatFormulaBoxForCopy(equation, "with-dollar")).toBe("$$\nE=mc^2\n$$");
		expect(formatFormulaBoxForCopy(equation, "without-dollar")).toBe("E=mc^2");
	});

	it("does not double-wrap", () => {
		const equation = box({ type: "interline_equation", formula: "$$ a+b $$" });
		expect(formatFormulaBoxForCopy(equation, "with-dollar")).toBe("$$\na+b\n$$");
		expect(formatFormulaBoxForCopy(equation, "without-dollar")).toBe("a+b");
	});

	it("wraps an inline formula in single dollars", () => {
		expect(formatBoxForCopy(box({ type: "inline_equation", markdown: "x^2", formula: "x^2" }))).toBe("$x^2$");
	});

	it("copies text as it is", () => {
		expect(formatBoxForCopy(box({ markdown: "  Hello $x$ world \n" }))).toBe("Hello $x$ world");
	});
});

describe("tables", () => {
	const table = box({ type: "table", markdown: TABLE, tableFormats: { html: TABLE } });

	it("returns the HTML", () => {
		expect(formatTableBoxForCopy(table, "html")).toBe(TABLE);
	});

	it("converts HTML to Markdown", () => {
		expect(formatTableBoxForCopy(table, "markdown")).toBe(
			["| Model | BLEU |", "| --- | --- |", "| A & B | $d_{model} \\cdot 2$ \\| 5% |"].join("\n"),
		);
	});

	it("converts HTML to TSV", () => {
		expect(formatTableBoxForCopy(table, "tsv")).toBe("Model\tBLEU\nA & B\t$d_{model} \\cdot 2$ | 5%");
	});

	it("converts HTML to LaTeX", () => {
		expect(formatTableBoxForCopy(table, "latex")).toBe(
			"\\begin{tabular}{cc}\nModel & BLEU \\\\\nA \\& B & $d_{model} \\cdot 2$ | 5\\%\n\\end{tabular}",
		);
	});

	it("prefers a format MinerU provided", () => {
		const provided = box({ type: "table", markdown: TABLE, tableFormats: { html: TABLE, markdown: "| a |" } });
		expect(formatTableBoxForCopy(provided, "markdown")).toBe("| a |");
	});

	it("handles a real table from the fixture", () => {
		const real = normalizeMinerUBoxes(loadFixture(ATTENTION)).find((candidate) => candidate.type === "table");
		expect(real).toBeDefined();
		const markdown = formatTableBoxForCopy(real as NormalizedBox, "markdown").split("\n");
		expect(markdown[0]).toBe("| Layer Type | Complexity per Layer | Sequential Operations | Maximum Path Length |");
		expect(markdown[1]).toBe("| --- | --- | --- | --- |");
		expect(markdown.length).toBeGreaterThan(3);
	});
});
