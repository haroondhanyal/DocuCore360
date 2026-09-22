import type { PDFDocumentProxy } from "pdfjs-dist";
let modulePromise: Promise<typeof import("pdfjs-dist")> | null = null;
export async function pdfjs() {
  modulePromise ??= import("pdfjs-dist").then((pdf) => {
    pdf.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
    return pdf;
  });
  return modulePromise;
}
export async function openPdf(bytes: ArrayBuffer, password?: string): Promise<PDFDocumentProxy> {
  const pdf = await pdfjs();
  return pdf.getDocument({
    data: new Uint8Array(bytes.slice(0)),
    password,
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    wasmUrl: "/pdfjs/wasm/",
  }).promise;
}
export function downloadBytes(bytes: Uint8Array, name: string, mime: string) {
  const blob = new Blob([new Uint8Array(bytes)], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export async function canvasBlob(canvas: HTMLCanvasElement, mime: string, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Your browser could not export this image.")),
      mime,
      quality,
    ),
  );
}
