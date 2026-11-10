import { PluginSettingTab, type App, type SettingDefinitionItem } from "obsidian";
import type MinerUPlugin from "./main";
import { formatBoxTypeLabel } from "./overlay/boxes";
import { MAX_FILL_OPACITY, applySettingChange, readSettingValue } from "./settingsModel";

/**
 * Settings tab, on Obsidian's declarative settings API (1.13+): rows are data
 * in {@link getSettingDefinitions}, which also makes them searchable.
 */
export class MinerUSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: MinerUPlugin,
	) {
		super(app, plugin);
	}

	override getControlValue(key: string): unknown {
		return readSettingValue(this.plugin.settings, key);
	}

	override async setControlValue(key: string, value: unknown): Promise<void> {
		await this.plugin.updateSettings(applySettingChange(this.plugin.settings, key, value));
	}

	override getSettingDefinitions(): SettingDefinitionItem[] {
		const hiddenTypes = (): string[] => this.plugin.settings.hiddenTypes;
		return [
			{
				type: "group",
				heading: "Results",
				items: [
					{
						name: "Results folder",
						desc: "Vault folder with one subfolder per PDF, named like the PDF without “.pdf”, holding MinerU's output (middle_json.json, images). Leave empty for the vault root.",
						aliases: ["mineru", "output", "middle_json"],
						control: { type: "text", key: "resultsFolder", placeholder: "MinerU" },
					},
				],
			},
			{
				type: "group",
				heading: "Layout overlay",
				items: [
					{
						name: "Default mode",
						desc: "How a PDF opens. Each PDF tab can be switched from its toolbar button or by command.",
						control: {
							type: "dropdown",
							key: "defaultMode",
							options: { all: "All boxes", hover: "Box under the pointer", off: "Off" },
						},
					},
					{
						name: "Reading-order numbers",
						desc: "Number each box by its position in MinerU's reading order on the page.",
						control: { type: "toggle", key: "showIndexBadges" },
					},
					{
						name: "Reading-order arrows",
						desc: "Join the boxes of a page with arrows in reading order.",
						control: { type: "toggle", key: "showArrows" },
					},
					{
						name: "Box fill opacity",
						desc: "How strongly boxes are tinted with their type color. 0 draws outlines only.",
						control: { type: "slider", key: "fillOpacity", min: 0, max: MAX_FILL_OPACITY, step: 0.05 },
					},
					{
						name: "Hidden block types",
						desc: "Block types are hidden and shown in the legend (right-click the toolbar button of a PDF). Select to show all of them again.",
						render: (setting) => {
							const hidden = hiddenTypes();
							setting
								.setName("Hidden block types")
								.setDesc(
									hidden.length === 0
										? "None. Block types are hidden and shown in the legend: right-click the toolbar button of a PDF."
										: `Hidden: ${hidden.map(formatBoxTypeLabel).join(", ")}.`,
								)
								.addButton((button) =>
									button
										.setButtonText("Show all")
										.setDisabled(hidden.length === 0)
										.onClick(() => {
											void this.setControlValue("hiddenTypes", []).then(() => this.update());
										}),
								);
						},
					},
				],
			},
		];
	}
}
