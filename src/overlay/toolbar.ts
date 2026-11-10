import { setIcon, setTooltip } from "obsidian";
import type { OverlayMode } from "../mineru/domain";
import { findToolbarHost } from "../pdf/viewerAdapter";

/** Marks our button, so it never collides with another plugin's. */
const BUTTON_ATTR = "data-mineru-toolbar-button";

const MODE_ICONS: Record<OverlayMode, string> = {
	all: "scan-text",
	hover: "scan-search",
	off: "scan",
};

const MODE_NAMES: Record<OverlayMode, string> = {
	all: "all boxes",
	hover: "box under the pointer",
	off: "off",
};

export interface ToolbarState {
	mode: OverlayMode;
	/** Whether the PDF has a MinerU result. */
	hasResult: boolean;
}

export interface ToolbarHandlers {
	onCycle(): void;
	onLegend(): void;
}

/**
 * Adds our button to the PDF toolbar unless it is already there, and brings
 * it up to date. Click cycles the mode; right-click opens the legend.
 */
export function syncToolbarButton(container: HTMLElement, state: ToolbarState, handlers: ToolbarHandlers): void {
	const host = findToolbarHost(container);
	if (!host) return;

	let button = host.querySelector<HTMLElement>(`[${BUTTON_ATTR}]`);
	if (!button) {
		button = host.createDiv({ cls: ["clickable-icon", "mineru-toolbar-button"], attr: { [BUTTON_ATTR]: "" } });
		button.addEventListener("click", (event) => {
			event.preventDefault();
			handlers.onCycle();
		});
		button.addEventListener("contextmenu", (event) => {
			event.preventDefault();
			event.stopPropagation();
			handlers.onLegend();
		});
	}

	const key = `${state.mode}:${state.hasResult}`;
	if (button.getAttribute(BUTTON_ATTR) === key) return;
	button.setAttribute(BUTTON_ATTR, key);
	setIcon(button, MODE_ICONS[state.mode]);
	button.toggleClass("is-active", state.hasResult && state.mode !== "off");
	button.toggleClass("mineru-no-result", !state.hasResult);
	setTooltip(
		button,
		state.hasResult
			? `MinerU layout: ${MODE_NAMES[state.mode]} (right-click for the legend)`
			: "MinerU layout: no result found for this PDF",
	);
}

export function removeToolbarButton(container: HTMLElement): void {
	container.querySelectorAll(`[${BUTTON_ATTR}]`).forEach((button) => button.remove());
}
