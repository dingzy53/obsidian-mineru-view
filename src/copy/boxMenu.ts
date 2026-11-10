import { Menu, Notice, type App, type TFile } from "obsidian";
import type { NormalizedBox, TableCopyTextFormat } from "../mineru/domain";
import { formatBoxTypeLabel, isFormulaBoxType, isTableBoxType, isVisualBoxType } from "../overlay/boxes";
import type { PageGeometry } from "../pdf/pageGeometry";
import { normalizedBoxToPdfRect } from "../pdf/rect";
import type { MinerUResult, ResultStore } from "../results/store";
import { formatBoxForCopy, formatFormulaBoxForCopy, formatTableBoxForCopy } from "./copyFormatter";
import { buildFileEmbed, buildRegionEmbed, buildRegionLink } from "./links";

export interface BoxMenuContext {
	app: App;
	store: ResultStore;
	geometry: PageGeometry;
	/** The PDF the box belongs to. */
	file: TFile;
	result: MinerUResult;
	/** The window the box is in (a popout has its own clipboard focus). */
	win: Window;
}

const TABLE_FORMATS: Array<{ format: TableCopyTextFormat; title: string }> = [
	{ format: "markdown", title: "Copy table as Markdown" },
	{ format: "html", title: "Copy table as HTML" },
	{ format: "latex", title: "Copy table as LaTeX" },
	{ format: "tsv", title: "Copy table as TSV" },
];

/** The menu of a box: copy its content, a link to its region, or an embed. */
export function openBoxMenu(context: BoxMenuContext, box: NormalizedBox, event: MouseEvent): void {
	const menu = new Menu();
	const typeLabel = formatBoxTypeLabel(box.type);
	menu.addItem((item) => item.setTitle(`${typeLabel} ${box.pageIndexLabel} · page ${box.page}`).setIsLabel(true));

	const copy = (title: string, icon: string, text: () => string | Promise<string>, what: string): void => {
		menu.addItem((item) =>
			item
				.setTitle(title)
				.setIcon(icon)
				.onClick(() => void copyToClipboard(context.win, text, what)),
		);
	};

	if (isFormulaBoxType(box.type)) {
		copy("Copy formula with $$", "sigma", () => formatFormulaBoxForCopy(box, "with-dollar"), "Formula");
		copy("Copy formula as LaTeX", "code", () => formatFormulaBoxForCopy(box, "without-dollar"), "LaTeX");
	} else if (isTableBoxType(box.type)) {
		for (const { format, title } of TABLE_FORMATS) {
			if (formatTableBoxForCopy(box, format)) {
				copy(title, "table", () => formatTableBoxForCopy(box, format), "Table");
			}
		}
	} else if (!isVisualBoxType(box.type) && formatBoxForCopy(box)) {
		copy("Copy text", "copy", () => formatBoxForCopy(box), "Text");
	}

	const image = context.store.imageFile(context.result, box);
	if (image) {
		copy(
			"Copy image embed",
			"image",
			() => buildFileEmbed(context.app.metadataCache.fileToLinktext(image, "", false)),
			"Image embed",
		);
	}

	menu.addSeparator();
	const linktext = context.app.metadataCache.fileToLinktext(context.file, "", false);
	const rect = async () => normalizedBoxToPdfRect(box.bbox, await context.geometry.getPageView(context.file, box.page));
	copy(
		"Copy link to region",
		"link",
		async () => buildRegionLink(linktext, box.page, await rect(), `${typeLabel} p.${box.page}`),
		"Link",
	);
	copy(
		"Copy embed of region",
		"crop",
		async () => buildRegionEmbed(linktext, box.page, await rect()),
		"Embed",
	);

	menu.showAtMouseEvent(event);
}

async function copyToClipboard(win: Window, text: () => string | Promise<string>, what: string): Promise<void> {
	try {
		await win.navigator.clipboard.writeText(await text());
		new Notice(`${what} copied.`, 1500);
	} catch (error) {
		console.error("MinerU: copy failed", error);
		new Notice(`Could not copy: ${error instanceof Error ? error.message : String(error)}`);
	}
}
