import type { App, FileView, TFile } from "obsidian";
import { openBoxMenu } from "../copy/boxMenu";
import type { NormalizedBox, OverlayMode } from "../mineru/domain";
import type { PageGeometry } from "../pdf/pageGeometry";
import { findLivePages, getPageAspect, getPageNumber } from "../pdf/viewerAdapter";
import type { MinerUResult, ResultStore } from "../results/store";
import { nextMode, type MinerUSettings } from "../settingsModel";
import { LAYER_CLASS, buildPageLayer, getBoxIndexFromEvent, type LayerOptions } from "./render";
import { removeToolbarButton, syncToolbarButton } from "./toolbar";

/** What a controller needs from the plugin. */
export interface OverlayHost {
	readonly app: App;
	readonly settings: MinerUSettings;
	readonly store: ResultStore;
	readonly geometry: PageGeometry;
	openLegend(controller: OverlayController): void;
}

/**
 * The overlay of one PDF view: loads the PDF's MinerU result, draws a layer on
 * each live page, and keeps the layers there.
 *
 * pdf.js removes children it does not own from a page whenever it resets the
 * page (zoom, rotation, scrolling it out of view and back), so a
 * `MutationObserver` on the view, batched per animation frame, puts missing
 * layers back. {@link sync} is idempotent: it only adds what is missing, so
 * the mutations it causes itself end after one more pass.
 */
export class OverlayController {
	/** Per-view mode; starts from the default in settings. */
	mode: OverlayMode;
	result: MinerUResult | null = null;

	private file: TFile | null;
	private observer: MutationObserver | null = null;
	private frame: { win: Window; id: number } | null = null;
	private stopMigrationWatch: (() => void) | null = null;
	private loadToken = 0;
	private destroyed = false;

	constructor(
		private readonly host: OverlayHost,
		private readonly view: FileView,
	) {
		this.mode = host.settings.defaultMode;
		this.file = view.file;
	}

	get container(): HTMLElement {
		return this.view.containerEl;
	}

	get filePath(): string | null {
		return this.file?.path ?? null;
	}

	/** The result folder this view's PDF maps to. */
	get resultFolder(): string | null {
		return this.file ? this.host.store.folderFor(this.file) : null;
	}

	start(): void {
		this.observe();
		// Moving the tab to another window re-parents the view; the observer
		// and animation frames belong to the old window.
		this.stopMigrationWatch = this.container.onWindowMigrated(() => {
			this.observe();
			this.refresh();
		});
		void this.reload();
	}

	/** Called when the view shows another file. */
	setFile(file: TFile | null): void {
		if (file?.path === this.file?.path) return;
		this.file = file;
		void this.reload();
	}

	/** Reads the result again (from the store's cache unless it was invalidated). */
	async reload(): Promise<void> {
		const token = ++this.loadToken;
		const result = this.file ? await this.host.store.get(this.file) : null;
		if (this.destroyed || token !== this.loadToken) return;
		this.result = result;
		this.refresh();
	}

	setMode(mode: OverlayMode): void {
		if (mode === this.mode) return;
		this.mode = mode;
		this.refresh();
	}

	cycleMode(): void {
		this.setMode(nextMode(this.mode));
	}

	/** Rebuilds every layer; for changes of mode, settings or result. */
	refresh(): void {
		if (this.destroyed) return;
		this.removeLayers();
		this.sync();
	}

	destroy(): void {
		this.destroyed = true;
		this.observer?.disconnect();
		this.observer = null;
		this.stopMigrationWatch?.();
		this.stopMigrationWatch = null;
		if (this.frame) this.frame.win.cancelAnimationFrame(this.frame.id);
		this.frame = null;
		this.removeLayers();
		removeToolbarButton(this.container);
	}

	private observe(): void {
		this.observer?.disconnect();
		const win = this.container.win;
		// The constructor of the element's own window, so it also works in popouts.
		this.observer = new (win as Window & typeof globalThis).MutationObserver(() => this.scheduleSync());
		this.observer.observe(this.container, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["data-loaded"],
		});
	}

	private scheduleSync(): void {
		if (this.frame || this.destroyed) return;
		const win = this.container.win;
		const id = win.requestAnimationFrame(() => {
			this.frame = null;
			this.sync();
		});
		this.frame = { win, id };
	}

	/** Adds the toolbar button and any missing layer. Changes nothing when all is in place. */
	private sync(): void {
		if (this.destroyed) return;
		syncToolbarButton(
			this.container,
			{ mode: this.mode, hasResult: this.result !== null },
			{ onCycle: () => this.onToolbarClick(), onLegend: () => this.host.openLegend(this) },
		);

		const result = this.result;
		const mode = this.mode;
		if (!result || mode === "off") {
			this.removeLayers();
			return;
		}

		const settings = this.host.settings;
		const options: Omit<LayerOptions, "aspect"> = {
			mode,
			showBadges: settings.showIndexBadges,
			showArrows: settings.showArrows,
			hiddenTypes: new Set(settings.hiddenTypes),
			fillOpacity: settings.fillOpacity,
		};
		for (const pageEl of findLivePages(this.container)) {
			if (pageEl.querySelector(`:scope > .${LAYER_CLASS}`)) continue;
			const pageNumber = getPageNumber(pageEl);
			const boxes = pageNumber === null ? undefined : result.pages.get(pageNumber);
			if (!boxes || boxes.length === 0) continue;
			const layer = buildPageLayer(pageEl, boxes, { ...options, aspect: getPageAspect(pageEl) });
			// Listeners live and die with the layer element.
			layer.addEventListener("click", (event) => this.onBoxEvent(event, boxes));
			layer.addEventListener("contextmenu", (event) => this.onBoxEvent(event, boxes));
		}
	}

	private removeLayers(): void {
		this.container.querySelectorAll(`.${LAYER_CLASS}`).forEach((layer) => layer.remove());
	}

	private onToolbarClick(): void {
		if (!this.result) {
			this.host.openLegend(this);
			return;
		}
		this.cycleMode();
	}

	private onBoxEvent(event: MouseEvent, boxes: NormalizedBox[]): void {
		const index = getBoxIndexFromEvent(event);
		const box = index === null ? undefined : boxes.find((candidate) => candidate.rawIndex === index);
		const file = this.file;
		const result = this.result;
		if (!box || !file || !result) return;
		event.preventDefault();
		event.stopPropagation();
		openBoxMenu({ ...this.host, file, result, win: this.container.win }, box, event);
	}
}
