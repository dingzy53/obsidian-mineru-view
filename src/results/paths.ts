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

/** A usable results root, or null when the value points outside the vault. */
export function validateResultsFolder(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const cleaned = cleanFolderPath(value);
	if (cleaned.split("/").includes("..")) return null;
	return cleaned;
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
