/*
 * Ported from mineru-for-zotero (src/modules/copyFormatter.ts), AGPL-3.0-or-later.
 * Copyright (C) Asianfleet; Copyright (C) 2026 Ding Zheng Yuan.
 * https://github.com/dingzy53/mineru-for-zotero
 */
import type {
	FormulaCopyMode,
	NormalizedBox,
	TableCopyTextFormat,
} from "../mineru/domain";

export function formatBoxForCopy(box: NormalizedBox): string {
	if (isDisplayFormulaBox(box)) {
		return formatFormulaBoxForCopy(box, "with-dollar");
	}

	if (isInlineFormulaBox(box) && !hasDollarWrappedFormula(box.markdown)) {
		return formatFormulaBoxForCopy(box, "with-dollar");
	}

	return box.markdown.trim();
}

export function formatFormulaBoxForCopy(
	box: NormalizedBox,
	mode: FormulaCopyMode,
): string {
	const formula = box.formula ?? box.markdown;
	if (mode === "without-dollar") {
		return stripOuterDollars(formula);
	}
	if (isDisplayFormulaBox(box)) {
		return `$$\n${stripOuterDollars(formula)}\n$$`;
	}
	return formatFormulaForCopy(stripOuterDollars(formula), "with-dollar");
}

export function formatFormulaForCopy(
	formula: string,
	mode: FormulaCopyMode,
): string {
	const value =
		mode === "with-dollar" ? stripOuterDollars(formula) : formula.trim();
	return mode === "with-dollar" ? `$${value}$` : value;
}

export function formatTableBoxForCopy(
	box: NormalizedBox,
	format: TableCopyTextFormat,
): string {
	const value = box.tableFormats?.[format];
	if (value) {
		return value.trim();
	}

	const html = box.tableFormats?.html?.trim() || findHtmlTable(box.markdown);
	if (format === "markdown") {
		// Middle JSON 2.0 carries tables as HTML only.
		return html ? htmlTableToMarkdown(html) : box.markdown.trim();
	}
	if (format === "html") {
		return html;
	}
	if (format === "tsv") {
		return html ? htmlTableToTsv(html) : markdownTableToTsv(box.markdown);
	}
	if (format === "latex") {
		return htmlTableToLatex(html);
	}
	return "";
}

function isDisplayFormulaBox(box: NormalizedBox): boolean {
	// "equation" is the display-formula block of Middle JSON 2.0.
	return ["interline_equation", "equation_interline", "equation", "formula"].includes(
		normalizeBoxType(box.type),
	);
}

function isInlineFormulaBox(box: NormalizedBox): boolean {
	return ["inline_equation", "equation_inline"].includes(
		normalizeBoxType(box.type),
	);
}

function hasDollarWrappedFormula(value: string): boolean {
	const trimmed = value.trim();
	return (
		trimmed.length >= 2 && trimmed.startsWith("$") && trimmed.endsWith("$")
	);
}

function stripOuterDollars(value: string): string {
	let stripped = value.trim();
	while (hasDollarWrappedFormula(stripped)) {
		stripped = stripped.slice(1, -1).trim();
	}
	return stripped;
}

function normalizeBoxType(type: string): string {
	return type.trim().toLowerCase();
}

function findHtmlTable(value: string): string {
	const match = /<table\b[\s\S]*?<\/table>/i.exec(value);
	return match?.[0]?.trim() ?? "";
}

function markdownTableToTsv(value: string): string {
	const rows = value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.startsWith("|") && line.endsWith("|"))
		.map(parseMarkdownTableRow)
		.filter((cells) => !isMarkdownSeparatorRow(cells));

	return rows.map((cells) => cells.join("\t")).join("\n");
}

function parseMarkdownTableRow(line: string): string[] {
	return line
		.slice(1, -1)
		.split("|")
		.map((cell) => cell.trim());
}

function isMarkdownSeparatorRow(cells: string[]): boolean {
	return cells.every((cell) => /^:?-+:?$/.test(cell.trim()));
}

function htmlTableToMarkdown(html: string): string {
	const rows = parseHtmlTableRows(html);
	if (rows.length === 0) {
		return "";
	}

	const columnCount = Math.max(...rows.map((row) => row.length));
	const normalizedRows = rows.map((row) => padCells(row, columnCount));
	const header = normalizedRows[0].map(formatMarkdownCell);
	const separator = Array.from({ length: columnCount }, () => "---");
	const body = normalizedRows
		.slice(1)
		.map((row) => row.map(formatMarkdownCell));
	return [header, separator, ...body].map(formatMarkdownRow).join("\n");
}

function htmlTableToTsv(html: string): string {
	return parseHtmlTableRows(html)
		.map((row) => row.map(formatTsvCell).join("\t"))
		.join("\n");
}

function htmlTableToLatex(html: string): string {
	const rows = parseHtmlTableRows(html);
	if (rows.length === 0) {
		return "";
	}

	const columnCount = Math.max(...rows.map((row) => row.length));
	const columns = "c".repeat(columnCount);
	const body = rows
		.map((row) => padCells(row, columnCount).map(formatLatexCell).join(" & "))
		.join(" \\\\\n");
	return `\\begin{tabular}{${columns}}\n${body}\n\\end{tabular}`;
}

function parseHtmlTableRows(html: string): string[][] {
	const rows: string[][] = [];
	const table = findHtmlTable(html);
	for (const rowMatch of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
		const cells = [
			...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi),
		]
			.map((match) => normalizeHtmlCellText(match[1]))
			.filter((cell, index, row) => cell || row.length > 1 || index === 0);
		if (cells.length > 0) {
			rows.push(cells);
		}
	}
	return rows;
}

/**
 * Private-use markers around a cell's inline formulas, so each output format
 * can escape the text around a formula without touching the formula itself.
 */
const MATH_OPEN = "\uE000";
const MATH_CLOSE = "\uE001";
const MATH_SEGMENT = /\uE000([^\uE000\uE001]*)\uE001/g;

/** Renders a parsed cell: `escapeText` for the text, `$…$` around formulas. */
function renderCell(cell: string, escapeText: (text: string) => string): string {
	let rendered = "";
	let last = 0;
	for (const match of cell.matchAll(MATH_SEGMENT)) {
		rendered += escapeText(cell.slice(last, match.index)) + `$${match[1]}$`;
		last = match.index + match[0].length;
	}
	return rendered + escapeText(cell.slice(last));
}

function normalizeHtmlCellText(value: string): string {
	return decodeHtmlEntities(
		value
			// Middle JSON 2.0 marks inline formulas in cells as <eq>…</eq>.
			.replace(/<eq>([\s\S]*?)<\/eq>/gi, (_match, formula: string) => `${MATH_OPEN}${formula.trim()}${MATH_CLOSE}`)
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<[^>]+>/g, "")
			.replace(/\r?\n/g, " ")
			.replace(/\s+/g, " ")
			.trim(),
	);
}

function decodeHtmlEntities(value: string): string {
	const namedEntities: Record<string, string> = {
		amp: "&",
		gt: ">",
		lt: "<",
		nbsp: " ",
		quot: '"',
	};
	return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, body) => {
		const key = String(body).toLowerCase();
		if (key.startsWith("#x")) {
			return decodeCodePoint(entity, parseInt(key.slice(2), 16));
		}
		if (key.startsWith("#")) {
			return decodeCodePoint(entity, parseInt(key.slice(1), 10));
		}
		return namedEntities[key] ?? entity;
	});
}

function decodeCodePoint(fallback: string, codePoint: number): string {
	return Number.isFinite(codePoint)
		? String.fromCodePoint(codePoint)
		: fallback;
}

function padCells(row: string[], columnCount: number): string[] {
	return [
		...row,
		...Array.from({ length: columnCount - row.length }, () => ""),
	];
}

function formatMarkdownRow(row: string[]): string {
	return `| ${row.join(" | ")} |`;
}

/**
 * A pipe would end the cell, also inside a formula. Backslashes stay as they
 * are: doubling them would break the LaTeX of inline formulas.
 */
function formatMarkdownCell(value: string): string {
	return renderCell(value, (text) => text).replace(/\|/g, "\\|");
}

function formatTsvCell(value: string): string {
	return renderCell(value, (text) => text)
		.replace(/\t/g, " ")
		.replace(/\r?\n/g, " ");
}

function formatLatexCell(value: string): string {
	return renderCell(value, escapeLatexCell);
}

function escapeLatexCell(value: string): string {
	return value.replace(/[\\{}$&#_%^~]/g, (char) => {
		switch (char) {
			case "\\":
				return "\\textbackslash{}";
			case "{":
				return "\\{";
			case "}":
				return "\\}";
			case "$":
				return "\\$";
			case "&":
				return "\\&";
			case "#":
				return "\\#";
			case "_":
				return "\\_";
			case "%":
				return "\\%";
			case "^":
				return "\\textasciicircum{}";
			case "~":
				return "\\textasciitilde{}";
			default:
				return char;
		}
	});
}
