import { modifyPdf, type PdfAction, type PdfOptions } from "@/lib/advanced/pdf";
self.onmessage = async ({
  data,
}: {
  data: { bytes: Uint8Array; action: PdfAction; options: PdfOptions };
}) => {
  try {
    const bytes = await modifyPdf(data.bytes, data.action, data.options);
    self.postMessage({ bytes });
  } catch (e) {
    self.postMessage({ error: e instanceof Error ? e.message : "PDF processing failed." });
  }
};
