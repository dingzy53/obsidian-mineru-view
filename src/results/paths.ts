/**
 * Where a PDF's MinerU result lives: `<root>/<pdf basename>/`. Pure path
 * logic; vault-relative paths with forward slashes, no leading or trailing
 * slash (the shape of Obsidian's `normalizePath`).
 */

export const DEFAULT_RESULTS_FOLDER = "MinerU";

/** Cleans a user-typed folder: trims, unifies slashes, drops `.`/empty parts. */
export function cleanFolderPath(value: string): string {
	return value
		.replace(/\\/g, "/")
		.split("/")
		.map((part) => part.trim())
		.filter((part) => part.length > 0 && part !== ".")
		.join("/");
}

export type ResultsFolderCheck =
	| { ok: true; path: string }
	| { ok: false; error: string };

/** Checks whether a results root path is valid and inside the visible vault. */
export function checkResultsFolder(value: unknown, configDir?: string): ResultsFolderCheck {
	if (typeof value !== "string") return { ok: false, error: "Results folder must be a path." };
	const rawSegments = value
		.replace(/\\/g, "/")
		.split("/")
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
	if (rawSegments.includes("..")) {
		return { ok: false, error: "Path cannot contain '..'." };
	}
	const cleaned = cleanFolderPath(value);
	if (!cleaned) return { ok: true, path: "" };

	const cleanedConfigDir = configDir ? cleanFolderPath(configDir) : "";
	if (cleanedConfigDir && (cleaned === cleanedConfigDir || cleaned.startsWith(`${cleanedConfigDir}/`))) {
		return { ok: false, error: "Cannot store results inside the Obsidian configuration folder." };
	}
	if (cleaned.split("/").some((part) => part.startsWith("."))) {
		return { ok: false, error: "Hidden folders starting with '.' are not supported." };
	}
	return { ok: true, path: cleaned };
}

/** A usable results root, or null when the value points outside the vault or into a hidden folder. */
export function validateResultsFolder(value: unknown, configDir?: string): string | null {
	const checked = checkResultsFolder(value, configDir);
	return checked.ok ? checked.path : null;
}

/**
 * The result folder for a PDF. Only the basename counts, so two PDFs with the
 * same name in different folders share one result folder (documented in the
 * README). An empty root means the vault root.
 */
export function resultFolderFor(root: string, pdfBasename: string): string {
	const cleanedRoot = cleanFolderPath(root);
	return cleanedRoot ? `${cleanedRoot}/${pdfBasename}` : pdfBasename;
}

/**
 * The result folder a changed vault path belongs to, or null when the path is
 * not inside a result folder. A change to the root itself (rename, delete)
 * returns the root, meaning "every result".
 */
export function resultFolderOfPath(root: string, changedPath: string): string | null {
	const cleanedRoot = cleanFolderPath(root);
	const path = cleanFolderPath(changedPath);
	if (cleanedRoot) {
		if (path === cleanedRoot) return cleanedRoot;
		if (!path.startsWith(`${cleanedRoot}/`)) return null;
	}
	const rest = cleanedRoot ? path.slice(cleanedRoot.length + 1) : path;
	const first = rest.split("/")[0];
	if (!first) return null;
	return cleanedRoot ? `${cleanedRoot}/${first}` : first;
}

/** Vault path of a result's image, e.g. `MinerU/paper/images/page_2_image_0.jpg`. */
export function resultImagePath(resultFolder: string, imagePath: string): string {
	return `${resultFolder}/${cleanFolderPath(imagePath)}`;
}

/** Box types MinerU crops into `images/page_{page_idx}_{type}_{index}.*`. */
const CROPPED_TYPES: Readonly<Record<string, readonly string[]>> = {
	image: ["image"],
	figure: ["figure", "image"],
	table: ["table"],
	chart: ["chart"],
};

const IMAGE_EXTENSIONS = ["jpg", "png", "jpeg", "webp"] as const;

/**
 * Where a box's image may be, relative to the result folder, most likely
 * first. The box's own `imagePath` comes first, also under `images/` when it
 * lacks that prefix. Then MinerU's naming, for results whose JSON omits the
 * path (mineru-for-zotero's `mineru-result.json`):
 * `images/page_{page - 1}_{type}_{sourceIndex}.{jpg,png,jpeg,webp}`.
 */
export function candidateBoxImagePaths(box: {
	imagePath?: string | null;
	page: number;
	type: string;
	sourceIndex?: number;
}): string[] {
	const candidates: string[] = [];
	const add = (path: string) => {
		if (path && !candidates.includes(path)) candidates.push(path);
	};

	const own = box.imagePath ? cleanFolderPath(box.imagePath) : "";
	if (own && !own.split("/").includes("..")) {
		add(own);
		if (!own.startsWith("images/")) add(`images/${own}`);
	}

	const types = CROPPED_TYPES[box.type];
	const index = box.sourceIndex;
	if (types && typeof index === "number" && Number.isInteger(index) && index >= 0 && Number.isInteger(box.page) && box.page >= 1) {
		for (const type of types) {
			for (const extension of IMAGE_EXTENSIONS) {
				add(`images/page_${box.page - 1}_${type}_${index}.${extension}`);
			}
		}
	}
	return candidates;
}
