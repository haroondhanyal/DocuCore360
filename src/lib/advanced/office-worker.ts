export function officePdf(
  bytes: Uint8Array,
  kind: "docx" | "xlsx",
  sheet: string,
  signal: AbortSignal,
  progress: (value: number) => void,
) {
  return new Promise<{ bytes: Uint8Array; replacements: number }>((resolve, reject) => {
    signal.throwIfAborted();
    const w = new Worker(new URL("../../workers/office.worker.ts", import.meta.url));
    const abort = () => {
      done();
      reject(new Error("Conversion cancelled."));
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error("Office conversion exceeded 60 seconds."));
    }, 60000);
    function done() {
      clearTimeout(timer);
      w.terminate();
      signal.removeEventListener("abort", abort);
    }
    signal.addEventListener("abort", abort, { once: true });
    w.onmessage = ({ data }) => {
      if (data.progress !== undefined) {
        progress(data.progress);
        return;
      }
      done();
      if (data.error) reject(new Error(data.error));
      else resolve(data.result);
    };
    w.onerror = () => {
      done();
      reject(new Error("Office worker could not process this document."));
    };
    w.postMessage({ bytes, kind, sheet });
  });
}
