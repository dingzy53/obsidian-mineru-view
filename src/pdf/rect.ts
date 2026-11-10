/** `[x1, y1, x2, y2]`: a PDF page's `view` box, or a rect in PDF user space. */
export type PdfBox = readonly [number, number, number, number];

/**
 * Converts a normalized box (0-1, origin top left, y down) to the rect of an
 * Obsidian PDF link: `[minX, minY, maxX, maxY]` in PDF user space (y up),
 * rounded to whole points. `view` is the page's view box, whose origin is not
 * always zero.
 */
export function normalizedBoxToPdfRect(
	bbox: { x: number; y: number; width: number; height: number },
	view: PdfBox,
): [number, number, number, number] {
	const [vx0, vy0, vx1, vy1] = view;
	const width = vx1 - vx0;
	const height = vy1 - vy0;
	const nx1 = bbox.x;
	const nx2 = bbox.x + bbox.width;
	const ny1 = bbox.y;
	const ny2 = bbox.y + bbox.height;
	return [
		Math.round(vx0 + nx1 * width),
		Math.round(vy0 + (1 - ny2) * height),
		Math.round(vx0 + nx2 * width),
		Math.round(vy0 + (1 - ny1) * height),
	];
}
