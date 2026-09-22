import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import type { EditedPageExport } from "./editor-types";
import type { Output } from "./types";

/** Map a point from the displayed, rotated CropBox to native PDF coordinates. */
export function displayToPdf(
  x: number,
  y: number,
  crop: { x: number; y: number; width: number; height: number },
  rotation: number,
) {
  switch (((rotation % 360) + 360) % 360) {
    case 90:
      return { x: crop.x + y, y: crop.y + x };
    case 180:
      return { x: crop.x + crop.width - x, y: crop.y + y };
    case 270:
      return { x: crop.x + crop.width - y, y: crop.y + crop.height - x };
    default:
      return { x: crop.x + x, y: crop.y + crop.height - y };
  }
}

export async function exportEditedPdf(
  source: ArrayBuffer,
  pages: EditedPageExport[],
  name: string,
  progress: (n: number) => void,
): Promise<Output> {
  if (!pages.length || pages.length > 500) throw new Error("Export between 1 and 500 pages.");
  const original = await PDFDocument.load(source.slice(0), { updateMetadata: false });
  const output = await PDFDocument.create();
  const fonts = {
    Helvetica: await output.embedFont(StandardFonts.Helvetica),
    "Times-Roman": await output.embedFont(StandardFonts.TimesRoman),
    Courier: await output.embedFont(StandardFonts.Courier),
  };
  let unsearchable = 0;
  for (let i = 0; i < pages.length; i++) {
    const edit = pages[i];
    const page =
      edit.sourcePage === null
        ? output.addPage([595.28, 841.89])
        : output.addPage((await output.copyPages(original, [edit.sourcePage]))[0]);
    const rotation = (page.getRotation().angle + edit.rotation) % 360;
    page.setRotation(degrees(rotation));
    const crop = page.getCropBox();
    if (edit.overlay) {
      const image = await output.embedPng(edit.overlay);
      const x = rotation === 90 || rotation === 180 ? crop.x + crop.width : crop.x;
      const y = rotation === 180 || rotation === 270 ? crop.y + crop.height : crop.y;
      page.drawImage(image, {
        x,
        y,
        width: rotation === 90 || rotation === 270 ? crop.height : crop.width,
        height: rotation === 90 || rotation === 270 ? crop.width : crop.height,
        rotate: degrees(rotation),
      });
    }
    // Original text remains untouched; a visual mask is not permanent redaction.
    for (const annotation of edit.text) {
      const font = fonts[annotation.family];
      try {
        font.encodeText(annotation.text);
      } catch {
        unsearchable++;
        continue;
      }
      const position = displayToPdf(annotation.x, annotation.y, crop, rotation);
      page.drawText(annotation.text, {
        ...position,
        size: annotation.size,
        font,
        rotate: degrees(rotation - annotation.angle),
        opacity: 0,
      });
    }
    progress(Math.round(((i + 1) / pages.length) * 95));
  }
  output.setProducer("DocuCore 360");
  const bytes = await output.save();
  progress(100);
  return {
    bytes,
    mime: "application/pdf",
    name,
    notice: `Edits are flattened as high-resolution overlays. Original document text is preserved. ${unsearchable ? "Some non-Latin annotations are visible but do not have a searchable text layer." : "Added Latin text includes an approximate searchable layer."} Visual masks do not remove underlying content.`,
  };
}
