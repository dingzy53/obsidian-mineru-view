import { TFile, TFolder, normalizePath, type App } from "obsidian";
import { normalizeMinerUBoxes } from "../mineru/boxNormalizer";
import type { NormalizedBox } from "../mineru/domain";
import { isMiddleJson, orderJsonCandidates } from "../mineru/selectRawJson";
import { getRenderablePageBoxes, groupBoxesByPage, listBoxTypes } from "../overlay/boxes";
import { candidateBoxImagePaths, resultFolderFor, resultFolderOfPath, resultImagePath } from "./paths";

/** A PDF's MinerU layout, ready to draw. */
export interface MinerUResult {
	/** Vault path of the result folder, e.g. `MinerU/paper`. */
	folder: string;
	/** Vault path of the JSON the boxes came from. */
	jsonPath: string;
	/** Boxes to draw, by 1-based page number. */
	pages: Map<number, NormalizedBox[]>;
	/** Block types present, in order of first appearance. */
	types: string[];
	/** Boxes per type, for the legend. */
	counts: Map<string, number>;
}

/**
 * Finds and caches MinerU results: `<results folder>/<pdf basename>/`, reading
 * `middle_json.json` or, failing that, any other JSON that is a middle JSON
 * (never `structured_content.json`, see `selectRawJson.ts`).
 */
export class ResultStore {
	private readonly cache = new Map<string, Promise<MinerUResult | null>>();

	constructor(
		private readonly app: App,
		private readonly getRoot: () => string,
	) {}

	/** The result folder a PDF maps to, whether or not it exists. */
	folderFor(pdf: TFile): string {
		return normalizePath(resultFolderFor(this.getRoot(), pdf.basename));
	}

	/** The PDF's result, or null when there is none. Never rejects. */
	get(pdf: TFile): Promise<MinerUResult | null> {
		const folder = this.folderFor(pdf);
		let result = this.cache.get(folder);
		if (!result) {
			result = this.load(folder).catch((error: unknown) => {
				console.error(`MinerU: could not read the result in "${folder}"`, error);
				return null;
			});
			this.cache.set(folder, result);
		}
		return result;
	}

	/**
	 * Drops what a changed vault path makes stale. Returns the affected result
	 * folder, `"*"` when everything was dropped, or null when nothing was.
	 */
	invalidatePath(path: string): string | null {
		const root = normalizePath(this.getRoot());
		const folder = resultFolderOfPath(this.getRoot(), path);
		if (folder === null) return null;
		if (folder === root) {
			this.cache.clear();
			return "*";
		}
		this.cache.delete(folder);
		return folder;
	}

	clear(): void {
		this.cache.clear();
	}

	/**
	 * The vault file of a box's image, or null when it was not exported. Tries
	 * each of `candidateBoxImagePaths`, so a JSON without `image_path` still
	 * finds MinerU's `images/page_N_<type>_K.jpg`.
	 */
	imageFile(result: MinerUResult, box: NormalizedBox): TFile | null {
		for (const candidate of candidateBoxImagePaths(box)) {
			const file = this.app.vault.getAbstractFileByPath(normalizePath(resultImagePath(result.folder, candidate)));
			if (file instanceof TFile) return file;
		}
		return null;
	}

	private async load(folderPath: string): Promise<MinerUResult | null> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!(folder instanceof TFolder)) return null;

		const files = new Map<string, TFile>();
		for (const child of folder.children) {
			if (child instanceof TFile) files.set(child.name, child);
		}

		for (const name of orderJsonCandidates([...files.keys()])) {
			const file = files.get(name);
			if (!file) continue;
			let parsed: unknown;
			try {
				parsed = JSON.parse(await this.app.vault.cachedRead(file));
			} catch {
				continue;
			}
			if (!isMiddleJson(parsed)) continue;

			const boxes = normalizeMinerUBoxes(parsed);
			const pages = groupBoxesByPage(boxes);
			for (const [page, pageBoxes] of pages) pages.set(page, getRenderablePageBoxes(pageBoxes));
			const drawn = [...pages.values()].flat();
			const counts = new Map<string, number>();
			for (const box of drawn) counts.set(box.type, (counts.get(box.type) ?? 0) + 1);
			return { folder: folderPath, jsonPath: file.path, pages, types: listBoxTypes(drawn), counts };
		}
		return null;
	}
}
