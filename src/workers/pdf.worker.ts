import { runPdfTask } from "../lib/pdf/core";
import type { PdfTask } from "../lib/pdf/types";
self.onmessage = async (event: MessageEvent<PdfTask>) => {
  try {
    const output = await runPdfTask(event.data, (progress) => self.postMessage({ progress }));
    self.postMessage({ output }, { transfer: [output.bytes.buffer] });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "This PDF could not be processed.",
    });
  }
};
