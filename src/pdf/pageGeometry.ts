import { loadPdfJs, type App, type TFile } from "obsidian";
import type { PdfBox } from "./rect";

/** The part of pdf.js used here. `loadPdfJs()` is typed `any`. */
interface PdfJsLike {
	getDocument(source: { data: ArrayBuffer }): { promise: Promise<PdfDocumentLike>; destroy(): Promise<void> };
}

interface PdfDocumentLike {
	numPages: number;
	getPage(pageNumber: number): Promise<{ view: number[] }>;
}

/**
 * Page view boxes in PDF points, needed only to turn a box into the `rect` of
 * a PDF link. Read with the official `loadPdfJs()` from the file's bytes, so
 * no viewer internals are involved. That loads a second copy of the document,
 * so it happens lazily on the first copy and is kept until the file changes
 * or {@link destroy}.
 */
export class PageGeometry {
	private loading: { key: string; task: Promise<LoadedDocument> } | null = null;
	private readonly views = new Map<string, PdfBox>();

	constructor(private readonly app: App) {}

	async getPageView(file: TFile, pageNumber: number): Promise<PdfBox> {
		const key = `${file.path}\n${file.stat.mtime}`;
		const cached = this.views.get(`${key}\n${pageNumber}`);
		if (cached) return cached;

		if (this.loading?.key !== key) {
			this.destroy();
			this.loading = { key, task: this.load(file) };
		}
		const { document } = await this.loading.task;
		const page = await document.getPage(pageNumber);
		const [x1, y1, x2, y2] = page.view;
		const view: PdfBox = [x1, y1, x2, y2];
		this.views.set(`${key}\n${pageNumber}`, view);
		return view;
	}

	destroy(): void {
		const loading = this.loading;
		this.loading = null;
		this.views.clear();
		if (loading) {
			void loading.task.then(
				(loaded) => loaded.destroy(),
				() => undefined,
			);
		}
	}

	private async load(file: TFile): Promise<LoadedDocument> {
		const pdfjs = (await loadPdfJs()) as PdfJsLike;
		const data = await this.app.vault.readBinary(file);
		const task = pdfjs.getDocument({ data });
		return { document: await task.promise, destroy: () => task.destroy() };
	}
}

interface LoadedDocument {
	document: PdfDocumentLike;
	destroy(): Promise<void>;
}
