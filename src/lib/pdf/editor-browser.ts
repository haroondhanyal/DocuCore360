import { FabricText, StaticCanvas } from "fabric";
import type { EditorPage, EditedPageExport, SearchableAnnotation } from "./editor-types";
import type { Output } from "./types";
export async function renderEditorOverlays(
  pages: EditorPage[],
  progress: (n: number) => void,
  signal: AbortSignal,
): Promise<EditedPageExport[]> {
  const result: EditedPageExport[] = [];
  let total = 0;
  for (let i = 0; i < pages.length; i++) {
    if (signal.aborted) throw new Error("Export cancelled.");
    const page = pages[i];
    if (!page.overlay.objects.length) {
      result.push({ sourcePage: page.sourcePage, rotation: page.rotation, text: [] });
      continue;
    }
    if (page.width * page.height > 20_000_000)
      throw new Error("This page is too large for an annotation overlay.");
    const canvas = new StaticCanvas(undefined, {
      width: page.width,
      height: page.height,
      enableRetinaScaling: false,
    });
    try {
      await canvas.loadFromJSON(page.overlay, undefined, { signal });
      canvas.renderAll();
      const text: SearchableAnnotation[] = [];
      for (const object of canvas.getObjects()) {
        if (!(object instanceof FabricText)) continue;
        const radians = (object.angle * Math.PI) / 180;
        const origin = object.getPointByOrigin("left", "top");
        const size = object.fontSize * object.scaleY;
        object.textLines.forEach((line, lineIndex) => {
          const baseline = size * (0.85 + lineIndex * object.lineHeight);
          text.push({
            text: line,
            x: origin.x - Math.sin(radians) * baseline,
            y: origin.y + Math.cos(radians) * baseline,
            size,
            angle: object.angle,
            family:
              /times|serif/i.test(object.fontFamily) && !/sans/i.test(object.fontFamily)
                ? "Times-Roman"
                : /courier|mono/i.test(object.fontFamily)
                  ? "Courier"
                  : "Helvetica",
          });
        });
      }
      const url = canvas.toDataURL({
        format: "png",
        multiplier: Math.min(2, Math.sqrt(40_000_000 / (page.width * page.height))),
      });
      const data = atob(url.slice(url.indexOf(",") + 1));
      const bytes = Uint8Array.from(data, (char) => char.charCodeAt(0));
      total += bytes.length;
      if (total > 150 * 1024 * 1024)
        throw new Error("Annotation output is too large. Export fewer pages.");
      result.push({ sourcePage: page.sourcePage, rotation: page.rotation, overlay: bytes, text });
    } finally {
      await canvas.dispose();
    }
    progress(Math.round(((i + 1) / pages.length) * 40));
  }
  return result;
}
export function assembleEditedPdf(
  source: ArrayBuffer,
  pages: EditedPageExport[],
  name: string,
  progress: (n: number) => void,
  signal: AbortSignal,
): Promise<Output> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("Export cancelled."));
      return;
    }
    const worker = new Worker(new URL("../../workers/editor.worker.ts", import.meta.url), {
      type: "module",
    });
    const cleanup = () => {
      worker.terminate();
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new Error("Export cancelled."));
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (
      event: MessageEvent<{ progress?: number; output?: Output; error?: string }>,
    ) => {
      if (event.data.progress !== undefined) progress(40 + Math.round(event.data.progress * 0.6));
      if (event.data.error) {
        cleanup();
        reject(new Error(event.data.error));
      }
      if (event.data.output) {
        cleanup();
        resolve(event.data.output);
      }
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error("The export worker stopped unexpectedly."));
    };
    worker.postMessage({ source, pages, name });
  });
}
