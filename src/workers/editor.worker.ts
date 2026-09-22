import { exportEditedPdf } from "../lib/pdf/editor-export";
import type { EditedPageExport } from "../lib/pdf/editor-types";
self.onmessage = async (
  event: MessageEvent<{ source: ArrayBuffer; pages: EditedPageExport[]; name: string }>,
) => {
  try {
    const output = await exportEditedPdf(
      event.data.source,
      event.data.pages,
      event.data.name,
      (progress) => self.postMessage({ progress }),
    );
    self.postMessage({ output }, { transfer: [output.bytes.buffer] });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "The edited PDF could not be exported.",
    });
  }
};
