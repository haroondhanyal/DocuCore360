import { describe, expect, it } from "vitest";
import { PDFDocument, degrees } from "pdf-lib";
import { displayToPdf, exportEditedPdf } from "@/lib/pdf/editor-export";
describe("Editor export coordinates", () => {
  const crop = { x: 10, y: 20, width: 300, height: 400 };
  it.each([
    [0, 10, 420],
    [90, 10, 20],
    [180, 310, 20],
    [270, 310, 420],
  ])("maps the visible top-left with rotation %s", (rotation, x, y) =>
    expect(displayToPdf(0, 0, crop, rotation)).toEqual({ x, y }),
  );
  it("maps an interior point on a rotated CropBox", () =>
    expect(displayToPdf(50, 70, crop, 90)).toEqual({ x: 80, y: 70 }));
  it("exports ordered and rotated pages without changing the source", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([300, 400]).setRotation(degrees(90));
    pdf.addPage([400, 500]);
    const source = new Uint8Array(await pdf.save());
    const original = source.slice();
    const result = await exportEditedPdf(
      source.buffer,
      [
        { sourcePage: 1, rotation: 0, text: [] },
        {
          sourcePage: 0,
          rotation: 90,
          text: [
            { text: "Added annotation", x: 40, y: 60, size: 18, angle: 0, family: "Helvetica" },
          ],
        },
        { sourcePage: null, rotation: 0, text: [] },
      ],
      "edited.pdf",
      () => {},
    );
    const output = await PDFDocument.load(result.bytes);
    expect(output.getPageCount()).toBe(3);
    expect(output.getPage(0).getWidth()).toBe(400);
    expect(output.getPage(1).getRotation().angle).toBe(180);
    expect(source).toEqual(original);
    expect(result.notice).toContain("do not remove");
  });
  it("keeps export usable for unsupported searchable characters and discloses the limitation", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const source = new Uint8Array(await pdf.save());
    const result = await exportEditedPdf(
      source.buffer,
      [
        {
          sourcePage: 0,
          rotation: 0,
          text: [{ text: "مرحبا", x: 30, y: 30, size: 18, angle: 0, family: "Helvetica" }],
        },
      ],
      "unicode.pdf",
      () => {},
    );
    expect(result.notice).toContain("non-Latin");
    expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(1);
  });
});
