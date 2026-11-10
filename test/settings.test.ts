import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, applySettingChange, mergeSettings, nextMode, withTypeHidden } from "../src/settingsModel";

describe("mergeSettings", () => {
	it("returns the defaults for nothing", () => {
		expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
		expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
	});

	it("repairs invalid values", () => {
		expect(
			mergeSettings({
				resultsFolder: "../x",
				defaultMode: "sometimes",
				showIndexBadges: "yes",
				hiddenTypes: ["text", 3, "text", ""],
				fillOpacity: 9,
				unknown: 1,
			}),
		).toEqual({ ...DEFAULT_SETTINGS, hiddenTypes: ["text"], fillOpacity: 0.6 });
	});

	it("keeps valid values", () => {
		const settings = {
			resultsFolder: "Parsed/MinerU",
			defaultMode: "hover" as const,
			showIndexBadges: false,
			showArrows: true,
			hiddenTypes: ["page_number"],
			fillOpacity: 0.3,
		};
		expect(mergeSettings(settings)).toEqual(settings);
	});
});

describe("setting changes", () => {
	it("validates a change from the UI", () => {
		expect(applySettingChange(DEFAULT_SETTINGS, "resultsFolder", " /Out/ ").resultsFolder).toBe("Out");
		expect(applySettingChange(DEFAULT_SETTINGS, "fillOpacity", -1).fillOpacity).toBe(0);
		expect(applySettingChange(DEFAULT_SETTINGS, "nope", 1)).toBe(DEFAULT_SETTINGS);
	});

	it("cycles modes", () => {
		expect(nextMode("all")).toBe("hover");
		expect(nextMode("hover")).toBe("off");
		expect(nextMode("off")).toBe("all");
	});

	it("hides and shows a type", () => {
		const hidden = withTypeHidden(DEFAULT_SETTINGS, "footer", true);
		expect(hidden.hiddenTypes).toEqual(["footer"]);
		expect(withTypeHidden(hidden, "footer", true).hiddenTypes).toEqual(["footer"]);
		expect(withTypeHidden(hidden, "footer", false).hiddenTypes).toEqual([]);
	});
});
