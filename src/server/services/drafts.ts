import { PDFDocument } from "pdf-lib";
import { draftSchema, validateDraftObjects } from "@/lib/validation/draft";
import { HttpError } from "@/server/http";
export async function parseDraft(input: unknown) {
  try {
    const draft = draftSchema.parse(input);
    validateDraftObjects(draft.pages);
    const bytes = Buffer.from(draft.source, "base64");
    if (bytes.length > 25 * 1024 * 1024) throw new Error("Source PDF exceeds 25 MB.");
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    if (
      pdf.getPageCount() > 500 ||
      draft.pages.some((p) => p.sourcePage !== null && p.sourcePage >= pdf.getPageCount())
    )
      throw new Error("Draft references an invalid source page.");
    return draft;
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "Invalid draft.");
  }
}
