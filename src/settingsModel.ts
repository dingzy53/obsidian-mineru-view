/**
 * Settings schema and normalisation. Pure module: no `import "obsidian"`, so
 * what ends up in `data.json` can be unit-tested.
 */
import { OVERLAY_MODES, type OverlayMode } from "./mineru/domain";
import { DEFAULT_RESULTS_FOLDER, validateResultsFolder } from "./results/paths";

export interface MinerUSettings {
	/** Vault folder holding one result folder per PDF, named after the PDF. */
	resultsFolder: string;
	/** Mode a PDF opens in; each view can then be switched on its own. */
	defaultMode: OverlayMode;
	/** Reading-order number in the corner of each box. */
	showIndexBadges: boolean;
	/** Arrows joining the boxes of a page in reading order. */
	showArrows: boolean;
	/** Block types whose boxes are not drawn (toggled in the legend). */
	hiddenTypes: string[];
	/** Opacity of the box fill, 0 to {@link MAX_FILL_OPACITY}. */
	fillOpacity: number;
}

export const MAX_FILL_OPACITY = 0.6;

export const DEFAULT_SETTINGS: MinerUSettings = {
	resultsFolder: DEFAULT_RESULTS_FOLDER,
	defaultMode: "all",
	showIndexBadges: true,
	showArrows: false,
	hiddenTypes: [],
	fillOpacity: 0.15,
};

export function sanitizeFillOpacity(value: unknown): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_SETTINGS.fillOpacity;
	return Math.round(Math.min(MAX_FILL_OPACITY, Math.max(0, value)) * 100) / 100;
}

/** Normalises whatever is in `data.json` into a complete settings object. */
export function mergeSettings(loaded: unknown): MinerUSettings {
	const raw = (loaded && typeof loaded === "object" ? loaded : {}) as Partial<Record<keyof MinerUSettings, unknown>>;
	return {
		resultsFolder: validateResultsFolder(raw.resultsFolder) ?? DEFAULT_SETTINGS.resultsFolder,
		defaultMode: OVERLAY_MODES.includes(raw.defaultMode as OverlayMode)
			? (raw.defaultMode as OverlayMode)
			: DEFAULT_SETTINGS.defaultMode,
		showIndexBadges:
			typeof raw.showIndexBadges === "boolean" ? raw.showIndexBadges : DEFAULT_SETTINGS.showIndexBadges,
		showArrows: typeof raw.showArrows === "boolean" ? raw.showArrows : DEFAULT_SETTINGS.showArrows,
		hiddenTypes: Array.isArray(raw.hiddenTypes)
			? [...new Set(raw.hiddenTypes.filter((type): type is string => typeof type === "string" && type !== ""))]
			: [],
		fillOpacity: sanitizeFillOpacity(raw.fillOpacity ?? DEFAULT_SETTINGS.fillOpacity),
	};
}

const SETTING_KEYS = new Set<string>(Object.keys(DEFAULT_SETTINGS));

/** Value shown by the settings tab's control for `key`. */
export function readSettingValue(settings: MinerUSettings, key: string): unknown {
	if (!SETTING_KEYS.has(key)) return undefined;
	return settings[key as keyof MinerUSettings];
}

/**
 * Returns the settings with one control's value applied, through
 * {@link mergeSettings} so UI values get the same validation as loaded ones.
 */
export function applySettingChange(settings: MinerUSettings, key: string, value: unknown): MinerUSettings {
	if (!SETTING_KEYS.has(key)) return settings;
	return mergeSettings({ ...settings, [key]: value });
}

/** The next mode when cycling: all → hover → off → all. */
export function nextMode(mode: OverlayMode): OverlayMode {
	return OVERLAY_MODES[(OVERLAY_MODES.indexOf(mode) + 1) % OVERLAY_MODES.length];
}

/** Settings with one block type hidden or shown. */
export function withTypeHidden(settings: MinerUSettings, type: string, hidden: boolean): MinerUSettings {
	const types = new Set(settings.hiddenTypes);
	if (hidden) types.add(type);
	else types.delete(type);
	return { ...settings, hiddenTypes: [...types] };
}
