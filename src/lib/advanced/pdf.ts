import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  StandardFonts,
  degrees,
  rgb,
} from "pdf-lib";
import { parsePageRanges } from "@/lib/pdf/core";
export type PdfAction =
  | "watermark-pdf"
  | "page-numbers"
  | "header-footer"
  | "metadata-pdf"
  | "pdf-forms"
  | "compress-pdf";
export type PdfOptions = {
  text: string;
  secondary: string;
  pages: string;
  size: number;
  opacity: number;
  flatten: boolean;
  fields: Record<string, string>;
  clear: boolean;
  newField?: {
    type: "text" | "checkbox" | "dropdown";
    region?: { page: number; x: number; y: number; width: number; height: number };
    options: string[];
  };
};
export async function inspectForms(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  return doc
    .getForm()
    .getFields()
    .map((f) => ({
      name: f.getName(),
      type: f instanceof PDFTextField ? "text" : f instanceof PDFCheckBox ? "checkbox" : "choice",
      value:
        f instanceof PDFTextField
          ? (f.getText() ?? "")
          : f instanceof PDFCheckBox
            ? String(f.isChecked())
            : f instanceof PDFDropdown || f instanceof PDFOptionList
              ? f.getSelected().join(",")
              : f instanceof PDFRadioGroup
                ? (f.getSelected() ?? "")
                : "",
      options:
        f instanceof PDFDropdown || f instanceof PDFOptionList || f instanceof PDFRadioGroup
          ? f.getOptions()
          : [],
    }));
}
export async function modifyPdf(bytes: Uint8Array, action: PdfAction, o: PdfOptions) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  if (doc.getPageCount() > 500) throw new Error("Limit: 500 pages.");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const selected = o.pages.trim()
    ? parsePageRanges(o.pages, doc.getPageCount())
    : doc.getPageIndices();
  if (action === "metadata-pdf") {
    doc.setTitle(o.clear ? "" : o.text);
    doc.setAuthor(o.clear ? "" : o.secondary);
    if (o.clear) {
      doc.setSubject("");
      doc.setKeywords([]);
      doc.setCreator("");
      doc.setProducer("");
      doc.catalog.delete((await import("pdf-lib")).PDFName.of("Metadata"));
    }
  } else if (action === "pdf-forms") {
    const form = doc.getForm();
    for (const [name, value] of Object.entries(o.fields)) {
      const f = form.getField(name);
      if (f instanceof PDFTextField) f.setText(value);
      else if (f instanceof PDFCheckBox) {
        if (value === "true") f.check();
        else f.uncheck();
      } else if (
        f instanceof PDFDropdown ||
        f instanceof PDFOptionList ||
        f instanceof PDFRadioGroup
      ) {
        if (value) f.select(value);
      }
    }
    if (o.text.trim()) {
      if (form.getFieldMaybe(o.text)) throw new Error("A field with that name already exists.");
      const r = o.newField?.region;
      const page = doc.getPage(r ? r.page - 1 : (selected[0] ?? 0));
      if (r && page.getRotation().angle % 360 !== 0)
        throw new Error("Visual field placement currently requires an unrotated page.");
      const box = r
        ? {
            x: (page.getWidth() * r.x) / 100,
            y: page.getHeight() * (1 - (r.y + r.height) / 100),
            width: (page.getWidth() * r.width) / 100,
            height: (page.getHeight() * r.height) / 100,
          }
        : { x: 40, y: 40, width: 240, height: 28 };
      if (o.newField?.type === "checkbox") {
        const f = form.createCheckBox(o.text);
        f.addToPage(page, box);
        if (o.secondary === "true") f.check();
      } else if (o.newField?.type === "dropdown") {
        if (!o.newField.options.length) throw new Error("Add at least one dropdown choice.");
        const f = form.createDropdown(o.text);
        f.addOptions(o.newField.options);
        f.addToPage(page, box);
        if (o.secondary) f.select(o.secondary);
      } else {
        const f = form.createTextField(o.text);
        f.addToPage(page, box);
        f.setText(o.secondary);
      }
    }
    form.updateFieldAppearances(font);
    if (o.flatten) form.flatten();
  } else if (action !== "compress-pdf") {
    for (const i of selected) {
      const page = doc.getPage(i);
      const { width, height } = page.getSize();
      const text = o.text
        .replaceAll("{page}", String(i + 1))
        .replaceAll("{pages}", String(doc.getPageCount()));
      if (action === "watermark-pdf")
        page.drawText(text, {
          x: Math.max(10, (width - font.widthOfTextAtSize(text, o.size)) / 2),
          y: height / 2,
          size: o.size,
          font,
          color: rgb(0.4, 0.4, 0.4),
          opacity: o.opacity,
          rotate: degrees(30),
        });
      else if (action === "page-numbers")
        page.drawText(text || String(i + 1), { x: width / 2, y: 24, size: o.size, font });
      else {
        page.drawText(text, { x: 40, y: height - 30, size: o.size, font });
        page.drawText(
          o.secondary
            .replaceAll("{page}", String(i + 1))
            .replaceAll("{pages}", String(doc.getPageCount())),
          { x: 40, y: 24, size: o.size, font },
        );
      }
    }
  }
  const output = await doc.save({ useObjectStreams: true });
  return action === "compress-pdf" && output.length >= bytes.length ? bytes.slice() : output;
}
