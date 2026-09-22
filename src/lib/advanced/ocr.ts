import { createWorker, OEM, type Page } from "tesseract.js";
export async function recognize(
  image: HTMLCanvasElement | File,
  signal: AbortSignal,
  progress: (n: number) => void,
  language = "eng",
): Promise<Page> {
  signal.throwIfAborted();
  if (
    !language.split("+").every((l) => ["eng", "urd", "ara", "hin", "spa", "fra", "deu"].includes(l))
  )
    throw new Error("Unsupported OCR language.");
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  let rejectStop: (reason: Error) => void = () => {};
  let stopped = false;
  const interrupted = new Promise<never>((_, reject) => {
    rejectStop = reject;
  });
  const stop = () => {
    stopped = true;
    void worker?.terminate();
    rejectStop(new Error(signal.aborted ? "OCR cancelled." : "OCR exceeded the two-minute limit."));
  };
  signal.addEventListener("abort", stop, { once: true });
  const timer = setTimeout(stop, 120000);
  try {
    const startup = createWorker(language, OEM.LSTM_ONLY, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/core",
      langPath: "/ocr",
      workerBlobURL: false,
      logger: (m) => {
        if (m.status === "recognizing text") progress(m.progress);
      },
      errorHandler: () => rejectStop(new Error("OCR engine failed to process this image.")),
    }).then((value) => {
      worker = value;
      if (stopped) {
        void value.terminate();
        throw new Error("OCR cancelled.");
      }
      return value;
    });
    worker = await Promise.race([startup, interrupted]);
    const result = await Promise.race([
      worker.recognize(image, {}, { text: true, blocks: true }),
      interrupted,
    ]);
    signal.throwIfAborted();
    return result.data;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", stop);
    await worker?.terminate();
  }
}
export async function imageCanvas(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 40_000_000) throw new Error("Image exceeds 40 megapixels.");
    const c = document.createElement("canvas");
    c.width = bitmap.width;
    c.height = bitmap.height;
    c.getContext("2d")!.drawImage(bitmap, 0, 0);
    return c;
  } finally {
    bitmap.close();
  }
}
