import { Modal, Setting, type App } from "obsidian";
import type { MinerUSettings } from "../settingsModel";
import { formatBoxTypeLabel } from "./boxes";

export interface LegendContext {
	/** File name of the PDF. */
	title: string;
	/** Where its result is expected, shown when there is none. */
	resultFolder: string | null;
	/** Block types of the PDF's result with their box counts; null without a result. */
	types: Array<{ type: string; count: number }> | null;
	getSettings(): MinerUSettings;
	setTypeHidden(type: string, hidden: boolean): void;
	setShowBadges(value: boolean): void;
	setShowArrows(value: boolean): void;
}

/**
 * The legend: what each color means, with a switch per block type. Hidden
 * types are saved in settings and apply to every PDF.
 */
export class LegendModal extends Modal {
	constructor(
		app: App,
		private readonly context: LegendContext,
	) {
		super(app);
	}

	override onOpen(): void {
		const { contentEl, context } = this;
		this.setTitle("MinerU layout");
		this.modalEl.addClass("mineru-legend");
		contentEl.createEl("p", { cls: "mineru-legend-file", text: context.title });

		if (!context.types) {
			contentEl.createEl("p", {
				text: context.resultFolder
					? `No MinerU result found for this PDF. Put its output (with middle_json.json) in "${context.resultFolder}".`
					: "No MinerU result found for this PDF.",
			});
			return;
		}

		const settings = context.getSettings();
		new Setting(contentEl)
			.setName("Reading-order numbers")
			.addToggle((toggle) => toggle.setValue(settings.showIndexBadges).onChange((value) => context.setShowBadges(value)));
		new Setting(contentEl)
			.setName("Reading-order arrows")
			.addToggle((toggle) => toggle.setValue(settings.showArrows).onChange((value) => context.setShowArrows(value)));

		new Setting(contentEl).setName("Block types").setHeading();
		const hidden = new Set(settings.hiddenTypes);
		for (const { type, count } of context.types) {
			const row = new Setting(contentEl)
				.setName(formatBoxTypeLabel(type))
				.setDesc(count === 1 ? "1 box" : `${count} boxes`)
				.addToggle((toggle) =>
					toggle.setValue(!hidden.has(type)).onChange((value) => context.setTypeHidden(type, !value)),
				);
			row.settingEl.addClass("mineru-legend-row");
			row.nameEl.createSpan({ cls: "mineru-legend-swatch", attr: { "data-mineru-box-type": type }, prepend: true });
		}
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}
