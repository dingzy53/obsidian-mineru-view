import type { App, FileView, TFile } from "obsidian";
import { openBoxMenu } from "../copy/boxMenu";
import type { NormalizedBox, OverlayMode } from "../mineru/domain";
import type { PageGeometry } from "../pdf/pageGeometry";
import { findLivePages, findPageOf, getPageAspect, getPageNumber } from "../pdf/viewerAdapter";
import type { MinerUResult, ResultStore } from "../results/store";
import { nextMode, type MinerUSettings } from "../settingsModel";
import { findBoxAt } from "./boxes";
import { LAYER_CLASS, buildPageLayer, findBoxElement, getBoxIndexFromEvent, type LayerOptions } from "./render";
import { removeToolbarButton, syncToolbarButton } from "./toolbar";

/** Where the pointer is: enough of a mouse event to find the box under it. */
interface PointerAt {
	target: EventTarget | null;
	clientX: number;
	clientY: number;
}

const HOVERED_CLASS = "mineru-is-hovered";

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
 *
 * Boxes do not take the pointer, so the PDF keeps text selection and links.
 * The box under the pointer is found by position: it is highlighted while
 * hovered, and its menu opens on right-click (unless text is selected, so the
 * viewer's own menu stays available) or on a click on its badge.
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
	/** The visible boxes of each page layer, for hit-testing. */
	private readonly layerBoxes = new WeakMap<HTMLElement, NormalizedBox[]>();
	private readonly pointerListeners = new AbortController();
	private pointer: PointerAt | null = null;
	private pointerFrame: { win: Window; id: number } | null = null;
	private hovered: HTMLElement | null = null;

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
		this.listen();
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
		this.pointerListeners.abort();
		if (this.pointerFrame) this.pointerFrame.win.cancelAnimationFrame(this.pointerFrame.id);
		this.pointerFrame = null;
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

	/**
	 * Pointer listeners on the view's container, which stays the same element
	 * when the view moves to another window. Removed in {@link destroy}.
	 */
	private listen(): void {
		const signal = this.pointerListeners.signal;
		this.container.addEventListener("pointermove", (event) => this.onPointerMove(event), { signal });
		this.container.addEventListener("pointerleave", () => this.setHovered(null), { signal });
		// Capture, so the menu of a box replaces the viewer's own on that click.
		this.container.addEventListener("contextmenu", (event) => this.onContextMenu(event), { signal, capture: true });
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
			this.layerBoxes.set(
				layer,
				boxes.filter((box) => !options.hiddenTypes.has(box.type)),
			);
			// A click on a badge; the listener lives and dies with the layer element.
			layer.addEventListener("click", (event) => this.onBadgeClick(event));
		}
	}

	private removeLayers(): void {
		this.setHovered(null);
		this.container.querySelectorAll(`.${LAYER_CLASS}`).forEach((layer) => layer.remove());
	}

	/** The box at a point of the view, with the layer it is drawn on. */
	private boxAt(at: PointerAt): { box: NormalizedBox; layer: HTMLElement } | null {
		if (!this.result || this.mode === "off") return null;
		const target = at.target;
		if (!target || !(target as Node).instanceOf(Element)) return null;
		const pageEl = findPageOf(target as Element);
		const layer = pageEl?.querySelector<HTMLElement>(`:scope > .${LAYER_CLASS}`);
		const boxes = layer ? this.layerBoxes.get(layer) : undefined;
		if (!layer || !boxes) return null;

		// On a badge, which sits outside its box: that box.
		const badgeIndex = getBoxIndexFromEvent(at);
		if (badgeIndex !== null) {
			const box = boxes.find((candidate) => candidate.rawIndex === badgeIndex);
			return box ? { box, layer } : null;
		}
		const rect = layer.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return null;
		const box = findBoxAt(boxes, (at.clientX - rect.left) / rect.width, (at.clientY - rect.top) / rect.height);
		return box ? { box, layer } : null;
	}

	/** Hover highlight, at most once per frame. */
	private onPointerMove(event: PointerEvent): void {
		this.pointer = { target: event.target, clientX: event.clientX, clientY: event.clientY };
		if (this.pointerFrame) return;
		const win = this.container.win;
		const id = win.requestAnimationFrame(() => {
			this.pointerFrame = null;
			const at = this.pointer;
			const hit = at ? this.boxAt(at) : null;
			this.setHovered(hit ? findBoxElement(hit.layer, hit.box.rawIndex) : null);
		});
		this.pointerFrame = { win, id };
	}

	private setHovered(boxEl: HTMLElement | null): void {
		if (boxEl === this.hovered) return;
		this.hovered?.removeClass(HOVERED_CLASS);
		boxEl?.addClass(HOVERED_CLASS);
		this.hovered = boxEl;
	}

	private onContextMenu(event: MouseEvent): void {
		// Selected text: leave the right-click to the viewer.
		const selection = this.container.win.getSelection();
		if (selection && !selection.isCollapsed && selection.toString().trim() !== "") return;
		const hit = this.boxAt(event);
		if (hit) this.openMenu(event, hit.box);
	}

	private onBadgeClick(event: MouseEvent): void {
		const hit = this.boxAt(event);
		if (hit) this.openMenu(event, hit.box);
	}

	private onToolbarClick(): void {
		if (!this.result) {
			this.host.openLegend(this);
			return;
		}
		this.cycleMode();
	}

	private openMenu(event: MouseEvent, box: NormalizedBox): void {
		const file = this.file;
		const result = this.result;
		if (!file || !result) return;
		event.preventDefault();
		event.stopPropagation();
		openBoxMenu({ ...this.host, file, result, win: this.container.win }, box, event);
	}
}
