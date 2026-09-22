import type { PdfTask, Output } from "./types";
export function processPdf(
  task: PdfTask,
  progress: (n: number) => void,
  signal?: AbortSignal,
): Promise<Output> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Processing cancelled."));
      return;
    }
    const worker = new Worker(new URL("../../workers/pdf.worker.ts", import.meta.url), {
      type: "module",
    });
    const cleanup = () => {
      worker.terminate();
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new Error("Processing cancelled."));
    };
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = (
      e: MessageEvent<{ progress?: number; output?: Output; error?: string }>,
    ) => {
      if (e.data.progress !== undefined) progress(e.data.progress);
      if (e.data.error) {
        cleanup();
        reject(new Error(e.data.error));
      }
      if (e.data.output) {
        cleanup();
        resolve(e.data.output);
      }
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error("The document worker stopped unexpectedly. Try a smaller file."));
    };
    worker.postMessage(task);
  });
}
