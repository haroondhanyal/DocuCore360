export function securePdf(
  bytes: Uint8Array,
  action: string,
  password: string,
  signal: AbortSignal,
) {
  return new Promise<Uint8Array>((resolve, reject) => {
    signal.throwIfAborted();
    const worker = new Worker("/security/worker.mjs", { type: "module" });
    const cleanup = () => {
      clearTimeout(timer);
      worker.terminate();
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new Error("Processing cancelled."));
    };
    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Security processing exceeded 60 seconds."));
    }, 60000);
    worker.onerror = () => {
      cleanup();
      reject(new Error("This browser could not start the PDF security engine."));
    };
    worker.onmessage = ({ data }) => {
      cleanup();
      if (data.error) reject(new Error(data.error));
      else resolve(data.bytes);
    };
    worker.postMessage({
      bytes,
      action,
      password,
      owner: crypto.randomUUID() + crypto.randomUUID(),
    });
  });
}
