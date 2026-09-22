import type { PdfAction, PdfOptions } from "./pdf";
export function modifyPdfWorker(
  bytes: Uint8Array,
  action: PdfAction,
  options: PdfOptions,
  signal: AbortSignal,
) {
  return new Promise<Uint8Array>((resolve, reject) => {
    signal.throwIfAborted();
    const w = new Worker(new URL("../../workers/advanced.worker.ts", import.meta.url));
    const abort = () => {
      done();
      reject(new Error("Processing cancelled."));
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error("Processing exceeded 60 seconds."));
    }, 60000);
    function done() {
      clearTimeout(timer);
      w.terminate();
      signal.removeEventListener("abort", abort);
    }
    signal.addEventListener("abort", abort, { once: true });
    w.onmessage = ({ data }) => {
      done();
      if (data.error) reject(new Error(data.error));
      else resolve(data.bytes);
    };
    w.onerror = () => {
      done();
      reject(new Error("PDF worker failed."));
    };
    w.postMessage({ bytes, action, options });
  });
}
