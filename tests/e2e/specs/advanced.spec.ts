import { test, expect } from "../fixtures/test";
import { pdfFixture, pngFixture } from "../utils/documents";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { Document, Packer, Paragraph } from "docx";
import ExcelJS from "exceljs";
import JSZip from "jszip";
test("metadata and form field exports are real", async ({ page, tool }) => {
  await tool.open("metadata-pdf");
  await tool.upload([await pdfFixture(1)]);
  await page.getByLabel("Title", { exact: true }).fill("Verified title");
  await tool.process("Process PDF");
  expect((await PDFDocument.load((await tool.download()).bytes)).getTitle()).toBe("Verified title");
  await tool.open("pdf-forms");
  await tool.upload([await pdfFixture(1)]);
  await page.getByLabel("New field name (optional)").fill("Contact");
  await page.getByLabel("New field value").fill("Sofia");
  await tool.process("Process PDF");
  expect(
    (await PDFDocument.load((await tool.download()).bytes))
      .getForm()
      .getTextField("Contact")
      .getText(),
  ).toBe("Sofia");
});
test("permanent redaction discards original text", async ({ tool }) => {
  await tool.open("redact-pdf");
  await tool.upload([await pdfFixture(1)]);
  await tool.process("Process PDF");
  const out = await tool.download();
  await tool.open("pdf-to-text");
  await tool.upload([{ name: "redacted.pdf", mimeType: "application/pdf", buffer: out.bytes }]);
  await tool.process("Convert document");
  expect((await tool.download()).bytes.toString().trim()).toBe("");
});
test("image studio exports resized PNG", async ({ page, tool }) => {
  await tool.open("image-editor");
  await tool.upload([pngFixture]);
  await page.getByLabel("width", { exact: true }).fill("160");
  await page.getByLabel("height", { exact: true }).fill("120");
  await page.getByLabel("Export format").selectOption("image/png");
  await tool.process("Export images");
  const out = await tool.download();
  expect(out.bytes.readUInt32BE(16)).toBe(160);
  expect(out.bytes.readUInt32BE(20)).toBe(120);
});
test("Word and spreadsheet convert to PDFs and PDF to DOCX", async ({ tool }) => {
  await tool.open("docx-to-pdf");
  const bytes = await Packer.toBuffer(
    new Document({ sections: [{ children: [new Paragraph("Invoice alpha")] }] }),
  );
  await tool.upload([
    {
      name: "invoice.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: bytes,
    },
  ]);
  await tool.process("Convert document");
  expect((await PDFDocument.load((await tool.download()).bytes)).getPageCount()).toBe(1);
  await tool.open("xlsx-to-pdf");
  const book = new ExcelJS.Workbook();
  book.addWorksheet("Budget").addRows([
    ["Item", "Cost"],
    ["Hosting", 25],
  ]);
  await tool.upload([
    {
      name: "budget.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(await book.xlsx.writeBuffer()),
    },
  ]);
  await tool.process("Convert document");
  expect((await PDFDocument.load((await tool.download()).bytes)).getPageCount()).toBe(1);
  await tool.open("pdf-to-docx");
  await tool.upload([await pdfFixture(1)]);
  await tool.process("Convert document");
  const zip = await JSZip.loadAsync((await tool.download()).bytes);
  expect(await zip.file("word/document.xml")!.async("string")).toContain("DocuCore sample page 1");
});
test("OCR produces editable text and a searchable PDF without uploads", async ({ page, tool }) => {
  test.setTimeout(120000);
  await tool.open("ocr");
  const uploads: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") uploads.push(r.url());
  });
  await tool.upload([await pdfFixture(1)]);
  await page.getByRole("button", { name: "Recognize text", exact: true }).click();
  await expect(page.getByLabel("Recognized text", { exact: true })).toBeVisible({ timeout: 90000 });
  await expect(page.getByLabel("Recognized text", { exact: true })).toHaveValue(/DocuCore/i);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download searchable PDF" }).click();
  const file = await download;
  expect((await PDFDocument.load(await readFile((await file.path())!))).getPageCount()).toBe(1);
  expect(uploads).toHaveLength(0);
});
test("AES-256 password round trip rejects an incorrect password", async ({ page, tool }) => {
  await tool.open("protect-pdf");
  await tool.upload([await pdfFixture(1)]);
  await page.getByLabel("Document password").fill("correct-test-password");
  await tool.process("Process PDF");
  const locked = await tool.download();
  await expect(PDFDocument.load(locked.bytes)).rejects.toThrow();
  await tool.open("unlock-pdf");
  await tool.upload([{ name: "locked.pdf", mimeType: "application/pdf", buffer: locked.bytes }]);
  await page.getByLabel("Document password").fill("wrong-password");
  await page.getByRole("button", { name: "Process PDF", exact: true }).click();
  await expect(page.locator('.error[role="alert"]')).toContainText("could not be processed");
  await page.getByLabel("Document password").fill("correct-test-password");
  await tool.process("Process PDF");
  expect((await PDFDocument.load((await tool.download()).bytes)).getPageCount()).toBe(1);
});
test("local editor draft survives reload and deletes explicitly", async ({ page, tool }) => {
  await tool.open("edit-pdf");
  await tool.upload([await pdfFixture(1)]);
  await expect(page.getByRole("button", { name: "Save local draft", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Save local draft", exact: true }).click();
  await expect(page.getByText("Draft saved on this browser.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Restore local draft", exact: true }).click();
  await expect(page.locator(".editor-shell")).toBeVisible();
  await page.getByRole("button", { name: "Delete local draft", exact: true }).click();
  await expect(page.getByText("Local draft deleted.", { exact: true })).toBeVisible();
});

test("OCR cancellation returns control to the user", async ({ page, tool }) => {
  await tool.open("ocr");
  await tool.upload([await pdfFixture(10)]);
  await page.getByRole("button", { name: "Recognize text", exact: true }).click();
  await page.getByRole("button", { name: "Cancel OCR", exact: true }).click();
  await expect(page.locator('.error[role="alert"]')).toContainText("cancelled");
  await expect(page.getByRole("button", { name: "Recognize text", exact: true })).toBeEnabled();
});

test("table review exports real XLSX and comparison detects text", async ({ page, tool }) => {
  await tool.open("pdf-tables");
  await tool.upload([await pdfFixture(1)]);
  await page.getByRole("button", { name: "Detect table", exact: true }).click();
  await expect(page.getByLabel("Row 1 column 1", { exact: true })).toBeVisible();
  await page.getByLabel("Row 1 column 1", { exact: true }).fill("Reviewed cell");
  await tool.process("Export XLSX");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(new Uint8Array((await tool.download()).bytes).buffer);
  expect(book.worksheets[0].getCell("A1").text).toBe("Reviewed cell");
  await tool.open("compare-pdf");
  await tool.upload([await pdfFixture(1, "before.pdf"), await pdfFixture(2, "after.pdf")]);
  await page.getByRole("button", { name: "Compare documents", exact: true }).click();
  await expect(page.locator("pre").filter({ hasText: "DocuCore sample page 2" })).toBeVisible();
});

test("HTML conversion does not execute scripts or fetch external images", async ({
  page,
  tool,
}) => {
  await tool.open("html-to-pdf");
  const external: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("untrusted.example")) external.push(r.url());
  });
  await tool.upload([
    {
      name: "input.html",
      mimeType: "text/html",
      buffer: Buffer.from(
        '<h1>Safe report</h1><script>window.docucoreInjected=true</script><img src="https://untrusted.example/image.png">',
      ),
    },
  ]);
  await tool.process("Convert document");
  expect((await PDFDocument.load((await tool.download()).bytes)).getPageCount()).toBe(1);
  expect(
    await page.evaluate(() => Object.prototype.hasOwnProperty.call(window, "docucoreInjected")),
  ).toBe(false);
  expect(external).toHaveLength(0);
});
