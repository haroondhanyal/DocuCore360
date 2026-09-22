import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import JSZip from "jszip";
import { organizePdf, parsePageRanges, splitGroups, imagesToPdf, runPdfTask } from "@/lib/pdf/core";
import type { PdfSource, ImageSource } from "@/lib/pdf/types";
async function fixture(count = 3, id = "source"): Promise<PdfSource> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < count; i++) {
    const page = pdf.addPage([300 + i * 10, 400 + i * 10]);
    page.drawText(`Page ${i + 1} - DocuCore fixture`, { x: 20, y: 350, font });
    if (i === 1) page.setRotation(degrees(90));
  }
  return { id, name: `${id}.pdf`, bytes: new Uint8Array(await pdf.save()).buffer, count };
}
describe("Page range validation", () => {
  it("supports ranges, individual pages and whitespace", () =>
    expect(parsePageRanges("1-3, 5, 8 - 10", 10)).toEqual([0, 1, 2, 4, 7, 8, 9]));
  it("deduplicates selections while preserving order", () =>
    expect(parsePageRanges("3, 1-3", 3)).toEqual([2, 0, 1]));
  it("defaults to all pages", () => expect(parsePageRanges("", 3)).toEqual([0, 1, 2]));
  it.each(["0", "4", "3-1", "1-8", "foo", "1,", "1.5", "-2", "1-2-3"])(
    "rejects invalid input %s",
    (value) => expect(() => parsePageRanges(value, 3)).toThrow(),
  );
  it("supports distinct split methods", () => {
    expect(splitGroups("odd", 5, "", 1)).toEqual([[0, 2, 4]]);
    expect(splitGroups("even", 5, "", 1)).toEqual([[1, 3]]);
    expect(splitGroups("interval", 5, "", 2)).toEqual([[0, 1], [2, 3], [4]]);
    expect(splitGroups("ranges", 5, "1-2, 4-5", 1)).toEqual([
      [0, 1],
      [3, 4],
    ]);
  });
  it("rejects empty odd/even output and invalid intervals", () => {
    expect(() => splitGroups("even", 1, "", 1)).toThrow();
    expect(() => splitGroups("interval", 3, "", 0)).toThrow();
  });
});
describe("Real PDF outputs", () => {
  it("merges distinct documents without changing source bytes", async () => {
    const a = await fixture(2, "a"),
      b = await fixture(1, "b");
    const original = new Uint8Array(a.bytes).slice();
    const bytes = await organizePdf(
      [a, b],
      [
        { id: "1", sourceId: "a", pageIndex: 0, rotation: 0 },
        { id: "2", sourceId: "b", pageIndex: 0, rotation: 0 },
        { id: "3", sourceId: "a", pageIndex: 1, rotation: 0 },
      ],
    );
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(3);
    expect(pdf.getPage(2).getWidth()).toBe(310);
    expect(new Uint8Array(a.bytes)).toEqual(original);
  });
  it("reorders, duplicates, rotates, deletes and inserts blank pages", async () => {
    const source = await fixture();
    const result = await organizePdf(
      [source],
      [
        { id: "1", sourceId: source.id, pageIndex: 2, rotation: 90 },
        { id: "2", sourceId: source.id, pageIndex: 2, rotation: 0 },
        { id: "3", sourceId: null, pageIndex: 0, rotation: 0 },
      ],
    );
    const pdf = await PDFDocument.load(result);
    expect(pdf.getPageCount()).toBe(3);
    expect(pdf.getPage(0).getWidth()).toBe(320);
    expect(pdf.getPage(0).getRotation().angle).toBe(90);
    expect(pdf.getPage(1).getRotation().angle).toBe(0);
    expect(pdf.getPage(2).getWidth()).toBeCloseTo(595.28);
  });
  it("adds rotation to a previously rotated page", async () => {
    const source = await fixture();
    const result = await organizePdf(
      [source],
      [{ id: "1", sourceId: source.id, pageIndex: 1, rotation: 90 }],
    );
    expect((await PDFDocument.load(result)).getPage(0).getRotation().angle).toBe(180);
  });
  it("rejects zero-page exports and invalid source references", async () => {
    const source = await fixture();
    await expect(organizePdf([source], [])).rejects.toThrow();
    await expect(
      organizePdf([source], [{ id: "x", sourceId: "missing", pageIndex: 0, rotation: 0 }]),
    ).rejects.toThrow();
  });
  it("returns actual ZIPs containing the selected PDF pages", async () => {
    const source = await fixture();
    const result = await runPdfTask(
      { kind: "split", source, groups: [[0], [1, 2]], name: "sample" },
      () => {},
    );
    expect(result.mime).toBe("application/zip");
    const zip = await JSZip.loadAsync(result.bytes);
    expect(Object.keys(zip.files)).toHaveLength(2);
    const second = await zip.file("sample-part-2.pdf")!.async("uint8array");
    expect((await PDFDocument.load(second)).getPageCount()).toBe(2);
  });
  it("creates image PDFs with specified page dimensions", async () => {
    const bytes = Uint8Array.from(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAUAAAADwCAIAAAD+Tyo8AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAGPklEQVR4nO3VUQ0DARAC0ZMy2k5F5ddDf0izL0HAZoDl6fMSAgj0n0V45hcQAgikwEKAQPf2wALvPSAEUmAhQKB739AC7z0gBFJgIUCge9/QAu89IARSYCFAoHvf0ALvPSAEUmAhQKB739AC7z0gBFJgIUCge9/QAu89IARSYCFAoHvf0ALvPSAEUmAhQKB739AC7z0gBFJgIUCge9/QAu89IARSYCFAoHvf0ALvPSAEUmAhQKB739AC7z0gBFJgIUCge9/QAu89IARSYCFAoHvf0ALvPSAEUmAhQKB739AC7z0gBFJgIUCge9/QAu89IARSYCFAoHvf0ALvPSAEUmAhQKB739AC7z0gBFJgIUCge9/QAu89IARSYCFAoHvf0ALvPSAEUmAhQKB739AC7z0gBFJgIUCge9/QAu89IARSYCFAoHvf0ALvPSAEUmAhQKB739AC7z0gBFJgIUCge9/QAu89IARSYCFAoHvf0ALvPSAEUmAhQKB739AC7z0gBFJgIUCge9/QAu89IARSYCFAoHvf0ALvPSAEUmAhQKB739AC7z0gBFJgIUCge9/QAu89IARSYCFAoHvf0ALvPSAEUmAhQKB739AC7z0gBFJgIUCge9/QAu89IAQUWAgQeA8+Agu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEEiBhQCB7n1DC7z3gBBIgYUAge59Qwu894AQSIGFAIHufUMLvPeAEOjXGHwB/MAJLJX5TMwAAAAASUVORK5CYII=",
        "base64",
      ),
    );
    const image: ImageSource = {
      id: "i",
      name: "image.png",
      type: "image/png",
      bytes: bytes.buffer,
      width: 1,
      height: 1,
    };
    const result = await imagesToPdf([image, image], {
      size: "letter",
      orientation: "landscape",
      margin: 20,
      fit: "fill",
      width: 0,
      height: 0,
    });
    const pdf = await PDFDocument.load(result);
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getPage(0).getWidth()).toBe(792);
    expect(pdf.getPage(0).getHeight()).toBe(612);
  });
  it("rejects margins that consume an entire image page", async () => {
    const image: ImageSource = {
      id: "i",
      name: "image.png",
      type: "image/png",
      bytes: Uint8Array.from(
        Buffer.from(
          "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",
          "base64",
        ),
      ).buffer,
      width: 1,
      height: 1,
    };
    await expect(
      imagesToPdf([image], {
        size: "original",
        orientation: "portrait",
        margin: 24,
        fit: "fit",
        width: 0,
        height: 0,
      }),
    ).rejects.toThrow("Margins");
  });
});
