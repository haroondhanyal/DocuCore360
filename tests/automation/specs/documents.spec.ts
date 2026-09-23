import { scenario, expect } from "../support/scenario";
import { ToolPage } from "../../e2e/pages/ToolPage";
import { pdfFixture, pngFixture } from "../../e2e/utils/documents";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
const pairs = [
  [1, 1],
  [1, 2],
  [2, 1],
  [2, 2],
  [2, 3],
  [3, 2],
  [3, 4],
  [4, 1],
  [5, 3],
  [6, 4],
];
for (const [i, [a, b]] of pairs.entries())
  scenario(
    `DC-MERGE-${String(i + 1).padStart(3, "0")}`,
    "documents",
    `Merge ${a} and ${b} pages`,
    "two generated PDFs with known page counts",
    "merge and download the output",
    "the real PDF preserves the combined page count and geometry",
    async ({ page }) => {
      const tool = new ToolPage(page);
      await tool.open("merge-pdf");
      await tool.upload([await pdfFixture(a, "first.pdf"), await pdfFixture(b, "second.pdf")]);
      await tool.process("Merge PDFs");
      const out = await PDFDocument.load((await tool.download()).bytes);
      expect(out.getPageCount()).toBe(a + b);
      for (const p of out.getPages()) expect(p.getSize()).toEqual({ width: 595, height: 842 });
    },
  );
for (let pages = 1; pages <= 8; pages++)
  scenario(
    `DC-SPLIT-${String(pages).padStart(3, "0")}`,
    "documents",
    `Split ${pages} pages into individual PDFs`,
    "a generated multi-page PDF",
    "split every page and download the result",
    "one page exports a PDF; multiple pages export valid single-page ZIP entries",
    async ({ page }) => {
      const tool = new ToolPage(page);
      await tool.open("split-pdf");
      await tool.upload([await pdfFixture(pages)]);
      await page.getByLabel("Split method").selectOption("every");
      await tool.process("Split PDF");
      const output = await tool.download();
      if (pages === 1) {
        expect(output.name).toMatch(/\.pdf$/);
        expect((await PDFDocument.load(output.bytes)).getPageCount()).toBe(1);
        return;
      }
      const zip = await JSZip.loadAsync(output.bytes);
      const files = Object.values(zip.files).filter((f) => !f.dir);
      expect(files).toHaveLength(pages);
      for (const f of files)
        expect((await PDFDocument.load(await f.async("uint8array"))).getPageCount()).toBe(1);
    },
  );
const titles = [
  "Invoice 2026",
  "Quarterly Report",
  "R&D <draft>",
  "Client's copy",
  "Numbers 0123456789",
  "Mixed CASE title",
  "A".repeat(100),
  "Résumé café",
];
for (const [i, title] of titles.entries())
  scenario(
    `DC-META-${String(i + 1).padStart(3, "0")}`,
    "documents",
    `Metadata round trip ${i + 1}: ${title.slice(0, 25)}`,
    "a generated PDF",
    `set title variant ${i + 1} and export`,
    "the output PDF stores the exact title and original pages",
    async ({ page }) => {
      const tool = new ToolPage(page);
      await tool.open("metadata-pdf");
      await tool.upload([await pdfFixture(2)]);
      await page.getByLabel("Title", { exact: true }).fill(title);
      await tool.process("Process PDF");
      const out = await PDFDocument.load((await tool.download()).bytes);
      expect(out.getTitle()).toBe(title);
      expect(out.getPageCount()).toBe(2);
    },
  );
let n = 0;
for (const format of ["image/png", "image/jpeg", "image/webp"])
  for (const size of [
    [160, 120],
    [80, 60],
  ])
    scenario(
      `DC-IMAGE-${String(++n).padStart(3, "0")}`,
      "documents",
      `${format} image export at ${size.join("x")}`,
      "a known PNG image",
      "resize and export in the chosen format",
      "download bytes decode with the requested dimensions and format",
      async ({ page }) => {
        const { default: sharp } = await import("sharp");
        const tool = new ToolPage(page);
        await tool.open("image-editor");
        await tool.upload([pngFixture]);
        await page.getByLabel("width", { exact: true }).fill(String(size[0]));
        await page.getByLabel("height", { exact: true }).fill(String(size[1]));
        await page.getByLabel("Export format").selectOption(format);
        await tool.process("Export images");
        const m = await sharp((await tool.download()).bytes).metadata();
        expect(m.width).toBe(size[0]);
        expect(m.height).toBe(size[1]);
        expect(m.format).toBe(format.split("/")[1]);
      },
    );
for (const [i, text] of [
  "Simple document",
  "Line one\nLine two",
  "Budget: 123.45 USD",
  "Symbols: & < > ( )",
  "A paragraph with several words. ".repeat(50),
].entries())
  scenario(
    `DC-TEXT-${String(i + 1).padStart(3, "0")}`,
    "documents",
    `Text-to-PDF round trip variant ${i + 1}`,
    "UTF-8 plain text",
    "convert to PDF then extract its text",
    "the real PDF contains the input words",
    async ({ page }) => {
      const tool = new ToolPage(page);
      await tool.open("text-to-pdf");
      await tool.upload([{ name: "input.txt", mimeType: "text/plain", buffer: Buffer.from(text) }]);
      await tool.process("Convert document");
      const pdf = (await tool.download()).bytes;
      expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(0);
      await tool.open("pdf-to-text");
      await tool.upload([{ name: "output.pdf", mimeType: "application/pdf", buffer: pdf }]);
      await tool.process("Convert document");
      const actual = (await tool.download()).bytes.toString().replace(/\s+/g, " ").trim();
      expect(actual).toContain(text.replace(/\s+/g, " ").trim());
    },
  );
