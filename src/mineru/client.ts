/**
 * Seam for parsing PDFs through the MinerU API in a later version. v1 only
 * views results that already exist in the vault, so nothing implements this
 * yet; `src/results/store.ts` would call it when a PDF has no result folder.
 */
export interface MinerUParseRequest {
	/** The PDF's bytes. */
	data: ArrayBuffer;
	fileName: string;
	signal?: AbortSignal;
	onProgress?: (progress: { done: number; total: number }) => void;
}

/** One file of a parse result, relative to the result folder. */
export interface MinerUResultFile {
	path: string;
	bytes: Uint8Array;
}

export interface MinerUClient {
	/**
	 * Parses a PDF and resolves with the files of its result folder
	 * (`middle_json.json`, `markdown.md`, `images/...`).
	 */
	parse(request: MinerUParseRequest): Promise<MinerUResultFile[]>;
}
