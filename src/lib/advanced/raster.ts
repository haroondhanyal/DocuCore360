import { openPdf, canvasBlob } from "@/lib/pdf/browser";
import { PDFDocument } from "pdf-lib";
export async function renderPages(
  file: File,
  password: string,
  signal: AbortSignal,
  each: (canvas: HTMLCanvasElement, index: number, count: number) => Promise<void>,
  scale = 1.5,
) {
  const doc = await openPdf(await file.arrayBuffer(), password || undefined);
  const abort = () => {
    void doc.loadingTask.destroy();
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    if (doc.numPages > 100) throw new Error("This raster workflow supports up to 100 pages.");
    for (let n = 1; n <= doc.numPages; n++) {
      signal.throwIfAborted();
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale });
      if (viewport.width * viewport.height > 40_000_000)
        throw new Error("Page exceeds the 40 megapixel limit.");
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      await each(canvas, n - 1, doc.numPages);
      canvas.width = canvas.height = 1;
    }
  } finally {
    signal.removeEventListener("abort", abort);
    await doc.loadingTask.destroy();
  }
}
export async function rasterPdf(
  file: File,
  password: string,
  signal: AbortSignal,
  progress: (n: number) => void,
  region?:
    | { page: number; x: number; y: number; width: number; height: number }
    | { page: number; x: number; y: number; width: number; height: number }[],
  quality = 0.75,
) {
  const regions = region ? (Array.isArray(region) ? region : [region]) : [];
  if (regions.length > 100) throw new Error("Limit: 100 redaction regions.");
  for (const r of regions)
    if (
      !Number.isInteger(r.page) ||
      r.page < 0 ||
      ![r.x, r.y, r.width, r.height].every(Number.isFinite) ||
      r.x < 0 ||
      r.y < 0 ||
      r.width <= 0 ||
      r.height <= 0 ||
      r.x + r.width > 100 ||
      r.y + r.height > 100
    )
      throw new Error("Choose a valid redaction rectangle and page.");
  const output = await PDFDocument.create();
  let total = 0;
  await renderPages(file, password, signal, async (canvas, index, count) => {
    for (const r of regions) {
      if (r.page > count) throw new Error(`This document has only ${count} pages.`);
      if (r.page === 0 || r.page === index + 1) {
        const c = canvas.getContext("2d")!;
        c.fillStyle = "#000";
        c.fillRect(
          Math.floor((canvas.width * r.x) / 100),
          Math.floor((canvas.height * r.y) / 100),
          Math.ceil((canvas.width * r.width) / 100) + 1,
          Math.ceil((canvas.height * r.height) / 100) + 1,
        );
      }
    }
    const bytes = new Uint8Array(
      await (await canvasBlob(canvas, region ? "image/png" : "image/jpeg", quality)).arrayBuffer(),
    );
    total += bytes.length;
    if (total > 150 * 1024 * 1024) throw new Error("Output exceeds 150 MB.");
    const image = region ? await output.embedPng(bytes) : await output.embedJpg(bytes);
    const page = output.addPage([canvas.width / 1.5, canvas.height / 1.5]);
    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
    progress((index + 1) / count);
  });
  signal.throwIfAborted();
  return output.save();
}
