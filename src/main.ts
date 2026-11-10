import { FileView, Notice, Plugin, debounce, type TAbstractFile } from "obsidian";
import { OVERLAY_MODES, type OverlayMode } from "./mineru/domain";
import { OverlayController, type OverlayHost } from "./overlay/controller";
import { LegendModal } from "./overlay/legend";
import { PageGeometry } from "./pdf/pageGeometry";
import { PDF_VIEW_TYPE } from "./pdf/viewerAdapter";
import { ResultStore } from "./results/store";
import { MinerUSettingTab } from "./settings";
import { DEFAULT_SETTINGS, mergeSettings, withTypeHidden, type MinerUSettings } from "./settingsModel";

const MODE_COMMANDS: Record<OverlayMode, string> = {
	all: "Show all layout boxes",
	hover: "Show the layout box under the pointer",
	off: "Hide layout boxes",
};

export default class MinerUPlugin extends Plugin implements OverlayHost {
	settings: MinerUSettings = DEFAULT_SETTINGS;
	store!: ResultStore;
	geometry!: PageGeometry;

	/** One controller per open PDF view. */
	private readonly controllers = new Map<FileView, OverlayController>();

	override async onload(): Promise<void> {
		this.settings = mergeSettings(await this.loadData());
		this.store = new ResultStore(this.app, () => this.settings.resultsFolder);
		this.geometry = new PageGeometry(this.app);
		this.register(() => this.geometry.destroy());
		this.register(() => this.detachAll());

		this.addSettingTab(new MinerUSettingTab(this.app, this));
		this.addCommands();

		const scan = debounce(() => this.scanViews(), 50, true);
		this.registerEvent(this.app.workspace.on("layout-change", scan));
		this.registerEvent(this.app.workspace.on("active-leaf-change", scan));
		this.registerEvent(this.app.workspace.on("file-open", scan));

		const changed = (file: TAbstractFile, oldPath?: string): void => {
			this.onVaultChange(file.path);
			if (oldPath !== undefined) this.onVaultChange(oldPath);
		};
		this.registerEvent(this.app.vault.on("modify", (file) => changed(file)));
		this.registerEvent(this.app.vault.on("delete", (file) => changed(file)));
		this.registerEvent(this.app.vault.on("rename", (file, oldPath) => changed(file, oldPath)));
		this.app.workspace.onLayoutReady(() => {
			// Registered once the vault is loaded: before that, "create" fires
			// for every existing file.
			this.registerEvent(this.app.vault.on("create", (file) => changed(file)));
			this.scanViews();
		});
	}

	/** Saves new settings and redraws every overlay. */
	async updateSettings(next: MinerUSettings): Promise<void> {
		const folderChanged = next.resultsFolder !== this.settings.resultsFolder;
		this.settings = next;
		await this.saveData(next);
		if (folderChanged) {
			this.store.clear();
			for (const controller of this.controllers.values()) void controller.reload();
		} else {
			for (const controller of this.controllers.values()) controller.refresh();
		}
	}

	openLegend(controller: OverlayController): void {
		const result = controller.result;
		new LegendModal(this.app, {
			title: controller.filePath ?? "",
			resultFolder: controller.resultFolder,
			types: result ? result.types.map((type) => ({ type, count: result.counts.get(type) ?? 0 })) : null,
			getSettings: () => this.settings,
			setTypeHidden: (type, hidden) => void this.updateSettings(withTypeHidden(this.settings, type, hidden)),
			setShowBadges: (value) => void this.updateSettings({ ...this.settings, showIndexBadges: value }),
			setShowArrows: (value) => void this.updateSettings({ ...this.settings, showArrows: value }),
		}).open();
	}

	/** Gives every PDF view a controller and drops those of closed views. */
	private scanViews(): void {
		const open = new Set<FileView>();
		for (const leaf of this.app.workspace.getLeavesOfType(PDF_VIEW_TYPE)) {
			const view = leaf.view;
			// A deferred view (tab not shown yet) is not a FileView.
			if (!(view instanceof FileView)) continue;
			open.add(view);
			const controller = this.controllers.get(view);
			if (controller) {
				controller.setFile(view.file);
			} else {
				const created = new OverlayController(this, view);
				this.controllers.set(view, created);
				created.start();
			}
		}
		for (const [view, controller] of this.controllers) {
			if (!open.has(view)) {
				controller.destroy();
				this.controllers.delete(view);
			}
		}
	}

	private detachAll(): void {
		for (const controller of this.controllers.values()) controller.destroy();
		this.controllers.clear();
	}

	/** A file under the results folder changed: reload the overlays it feeds. */
	private onVaultChange(path: string): void {
		const folder = this.store.invalidatePath(path);
		if (folder === null) return;
		for (const controller of this.controllers.values()) {
			if (folder === "*" || controller.resultFolder === folder) this.reloadSoon(controller);
		}
	}

	/** Copying a result folder in fires many events; reload once they settle. */
	private readonly pendingReloads = new Set<OverlayController>();
	private readonly flushReloads = debounce(
		() => {
			for (const controller of this.pendingReloads) void controller.reload();
			this.pendingReloads.clear();
		},
		300,
		true,
	);

	private reloadSoon(controller: OverlayController): void {
		this.pendingReloads.add(controller);
		this.flushReloads();
	}

	private activeController(): OverlayController | null {
		const view = this.app.workspace.getActiveViewOfType(FileView);
		return (view && this.controllers.get(view)) ?? null;
	}

	private addCommands(): void {
		/** A command that needs the active tab to be a PDF. */
		const pdfCommand = (id: string, name: string, run: (controller: OverlayController) => void): void => {
			this.addCommand({
				id,
				name,
				checkCallback: (checking) => {
					const controller = this.activeController();
					if (!controller) return false;
					if (!checking) run(controller);
					return true;
				},
			});
		};
		const needsResult = (controller: OverlayController): boolean => {
			if (controller.result) return true;
			new Notice(`No MinerU result found in "${controller.resultFolder ?? ""}".`);
			return false;
		};

		pdfCommand("cycle-layout-mode", "Cycle layout mode", (controller) => {
			if (needsResult(controller)) controller.cycleMode();
		});
		for (const mode of OVERLAY_MODES) {
			pdfCommand(`layout-mode-${mode}`, MODE_COMMANDS[mode], (controller) => {
				if (mode === "off" || needsResult(controller)) controller.setMode(mode);
			});
		}
		pdfCommand("show-layout-legend", "Show layout legend", (controller) => this.openLegend(controller));
		pdfCommand("reload-result", "Reload result", (controller) => {
			this.store.clear();
			void controller.reload().then(() => {
				new Notice(controller.result ? "MinerU result reloaded." : "No MinerU result found for this PDF.");
			});
		});
		this.addCommand({
			id: "toggle-reading-order-arrows",
			name: "Toggle reading-order arrows",
			callback: () => void this.updateSettings({ ...this.settings, showArrows: !this.settings.showArrows }),
		});
	}
}
