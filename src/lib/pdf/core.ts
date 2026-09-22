import { PDFDocument, degrees } from "pdf-lib";
import JSZip from "jszip";
import type { PdfSource, PageSpec, ImageSource, ImageOptions, Output, PdfTask } from "./types";
export function parsePageRanges(value: string, count: number): number[] {
  if (!Number.isInteger(count) || count < 1) throw new Error("The PDF has no pages.");
  if (!value.trim()) return Array.from({ length: count }, (_, i) => i);
  const pages: number[] = [];
  for (const chunk of value.split(",")) {
    const match = chunk.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error("Use page numbers or ranges, for example 1-3, 5, 8-12.");
    const start = Number(match[1]),
      end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > count)
      throw new Error(
        `Page numbers must be between 1 and ${count}, with ranges in ascending order.`,
      );
    for (let i = start - 1; i < end; i++) if (!pages.includes(i)) pages.push(i);
  }
  return pages;
}
export function splitGroups(
  mode: string,
  count: number,
  range: string,
  interval: number,
): number[][] {
  if (mode === "ranges") {
    if (!range.trim()) throw new Error("Enter at least one page range.");
    return range.split(",").map((part) => parsePageRanges(part, count));
  }
  if (mode === "selected") return [parsePageRanges(range, count)];
  const all = Array.from({ length: count }, (_, i) => i);
  if (mode === "odd" || mode === "even") {
    const selected = all.filter((i) => (mode === "odd" ? i % 2 === 0 : i % 2 === 1));
    if (!selected.length) throw new Error("No pages match this selection.");
    return [selected];
  }
  if (mode === "every") return all.map((i) => [i]);
  if (!Number.isInteger(interval) || interval < 1 || interval > count)
    throw new Error(`Enter an interval between 1 and ${count}.`);
  const groups: number[][] = [];
  for (let i = 0; i < count; i += interval) groups.push(all.slice(i, i + interval));
  return groups;
}
async function loadSource(source: PdfSource) {
  try {
    const doc = await PDFDocument.load(source.bytes.slice(0), { updateMetadata: false });
    if (doc.getPageCount() > 500) throw new Error("Use a document with up to 500 pages.");
    return doc;
  } catch (e) {
    if (e instanceof Error && /encrypted/i.test(e.message))
      throw new Error(
        "This PDF is password protected. Phase 2 supports viewing with a password, but cannot modify encrypted PDFs.",
      );
    throw e;
  }
}
export async function organizePdf(
  sources: PdfSource[],
  pages: PageSpec[],
  progress: (n: number) => void = () => {},
): Promise<Uint8Array> {
  if (!pages.length) throw new Error("Keep at least one page in the output.");
  if (pages.length > 500) throw new Error("Limit each output to 500 pages.");
  const loaded = new Map<string, PDFDocument>();
  for (const source of sources) loaded.set(source.id, await loadSource(source));
  const output = await PDFDocument.create();
  for (let i = 0; i < pages.length; i++) {
    const spec = pages[i];
    if (spec.sourceId === null) {
      const page = output.addPage([595.28, 841.89]);
      page.setRotation(degrees(spec.rotation));
    } else {
      const source = loaded.get(spec.sourceId);
      if (!source || spec.pageIndex < 0 || spec.pageIndex >= source.getPageCount())
        throw new Error("An output page references an invalid source.");
      const [copy] = await output.copyPages(source, [spec.pageIndex]);
      copy.setRotation(degrees((copy.getRotation().angle + spec.rotation) % 360));
      output.addPage(copy);
    }
    progress(Math.round(((i + 1) / pages.length) * 90));
  }
  output.setProducer("DocuCore 360");
  const bytes = await output.save();
  progress(100);
  return bytes;
}
export async function imagesToPdf(
  images: ImageSource[],
  options: ImageOptions,
  progress: (n: number) => void = () => {},
) {
  if (!images.length) throw new Error("Choose at least one image.");
  if (!Number.isFinite(options.margin) || options.margin < 0 || options.margin > 144)
    throw new Error("Use a margin between 0 and 144 points.");
  const doc = await PDFDocument.create();
  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    const img =
      item.type === "image/png" ? await doc.embedPng(item.bytes) : await doc.embedJpg(item.bytes);
    let [width, height] =
      options.size === "a4"
        ? [595.28, 841.89]
        : options.size === "letter"
          ? [612, 792]
          : options.size === "original"
            ? [item.width * 0.75, item.height * 0.75]
            : [options.width, options.height];
    if (options.size !== "original" && options.orientation === "landscape")
      [width, height] = [Math.max(width, height), Math.min(width, height)];
    if (![width, height].every((n) => Number.isFinite(n) && n > 0 && n <= 14_400))
      throw new Error("Page dimensions must be between 1 and 14,400 points.");
    const availableWidth = width - options.margin * 2,
      availableHeight = height - options.margin * 2;
    if (availableWidth <= 0 || availableHeight <= 0)
      throw new Error("Margins are larger than the page. Reduce the margin.");
    const scale =
      options.fit === "fill"
        ? Math.max(availableWidth / img.width, availableHeight / img.height)
        : Math.min(availableWidth / img.width, availableHeight / img.height);
    const page = doc.addPage([width, height]);
    // Clip fill images to the content box so the configured margins stay empty.
    const { pushGraphicsState, popGraphicsState, rectangle, clip, endPath } =
      await import("pdf-lib");
    page.pushOperators(
      pushGraphicsState(),
      rectangle(options.margin, options.margin, availableWidth, availableHeight),
      clip(),
      endPath(),
    );
    page.drawImage(img, {
      x: (width - img.width * scale) / 2,
      y: (height - img.height * scale) / 2,
      width: img.width * scale,
      height: img.height * scale,
    });
    page.pushOperators(popGraphicsState());
    progress(Math.round(((i + 1) / images.length) * 90));
  }
  doc.setProducer("DocuCore 360");
  const result = await doc.save();
  progress(100);
  return result;
}
export async function runPdfTask(task: PdfTask, progress: (n: number) => void): Promise<Output> {
  if (task.kind === "organize")
    return {
      bytes: await organizePdf(task.sources, task.pages, progress),
      name: task.name,
      mime: "application/pdf",
    };
  if (task.kind === "images")
    return {
      bytes: await imagesToPdf(task.images, task.options, progress),
      name: "images-combined.pdf",
      mime: "application/pdf",
    };
  if (!task.groups.length || task.groups.some((g) => !g.length))
    throw new Error("Select at least one page.");
  const source = await loadSource(task.source);
  const zip = new JSZip();
  let single: Uint8Array | undefined;
  for (let i = 0; i < task.groups.length; i++) {
    const doc = await PDFDocument.create();
    const pages = await doc.copyPages(source, task.groups[i]);
    pages.forEach((p) => doc.addPage(p));
    single = await doc.save();
    zip.file(`${task.name}-part-${i + 1}.pdf`, single);
    progress(Math.round(((i + 1) / task.groups.length) * 90));
  }
  const bytes =
    task.groups.length === 1 ? single! : await zip.generateAsync({ type: "uint8array" });
  progress(100);
  return {
    bytes,
    name: task.groups.length === 1 ? `${task.name}-extracted.pdf` : `${task.name}-split.zip`,
    mime: task.groups.length === 1 ? "application/pdf" : "application/zip",
  };
}
