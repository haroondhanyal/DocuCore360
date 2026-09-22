import { test, expect } from "../fixtures/test";
import { pdfFixture, pngFixture } from "../utils/documents";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
test("overview, search, favorites and active OCR state", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Less paperwork. More possibility." }),
  ).toBeVisible();
  await page.getByLabel("Search all tools").fill("merge pdf");
  await expect(page.locator(".search-results").getByText("Merge PDF")).toBeVisible();
  await page.getByLabel("Search all tools").fill("");
  await page.getByLabel("Favorite Merge PDF", { exact: true }).click();
  await page.getByRole("tab", { name: "Favorites" }).click();
  await expect(page.locator(".tool-grid").getByText("Merge PDF")).toBeVisible();
  await page.goto("/tools/ocr");
  await expect(page.getByRole("button",{name:"Recognize text",exact:true})).toBeVisible();
  await page.goto("/tools?category=PDF");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Convert", exact: true })
    .click();
  await expect(
    page.locator(".tool-grid").getByRole("heading", { name: "Word to PDF", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".tool-grid").getByRole("heading", { name: "Merge PDF", exact: true }),
  ).toHaveCount(0);
});
test("reader renders, searches, navigates and rotates", async ({ page, tool }) => {
  await tool.open("pdf-reader");
  await tool.upload([await pdfFixture()]);
  await expect(page.getByRole("button", { name: "Next page", exact: true })).toBeVisible();
  await expect(page.locator(".reader-page canvas").first()).toBeVisible();
  await page.getByRole("button", { name: "Search document" }).click();
  await page.getByLabel("Find in document").fill("DocuCore");
  await expect(page.getByText("1 of 3 · page 1")).toBeVisible();
  await page.getByRole("button", { name: "Next match" }).click();
  await expect(page.getByText("2 of 3 · page 2")).toBeVisible();
  await page.getByLabel("Page view mode").selectOption("single");
  await page.getByRole("button", { name: "Rotate view" }).click();
  await expect(page.getByLabel("Page number", { exact: true })).toHaveValue("2");
});
test("merge exports the combined page count", async ({ tool }) => {
  await tool.open("merge-pdf");
  await tool.upload([await pdfFixture(2, "one.pdf"), await pdfFixture(3, "two.pdf")]);
  await tool.process("Merge PDFs");
  const output = await tool.download();
  expect((await PDFDocument.load(output.bytes)).getPageCount()).toBe(5);
});
test("split exports valid ZIP entries", async ({ page, tool }) => {
  await tool.open("split-pdf");
  await tool.upload([await pdfFixture(3)]);
  await page.getByLabel("Split method").selectOption("every");
  await tool.process("Split PDF");
  const output = await tool.download();
  expect(output.name).toMatch(/\.zip$/);
  const zip = await JSZip.loadAsync(output.bytes);
  expect(Object.keys(zip.files)).toHaveLength(3);
  for (const entry of Object.values(zip.files))
    expect((await PDFDocument.load(await entry.async("uint8array"))).getPageCount()).toBe(1);
});
test("organizer exports rotation, duplication and blank pages", async ({ page, tool }) => {
  await tool.open("organize-pdf");
  await tool.upload([await pdfFixture(2)]);
  await expect(
    page.getByRole("button", { name: "Rotate page 1 right", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rotate page 1 right", exact: true }).click();
  await page.getByRole("button", { name: "Duplicate page 1", exact: true }).click();
  await page.getByRole("button", { name: "Blank page", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await tool.process("Export organized PDF");
  const output = await tool.download();
  const doc = await PDFDocument.load(output.bytes);
  expect(doc.getPageCount()).toBe(4);
  expect(doc.getPage(0).getRotation().angle).toBe(90);
});
test("images to PDF produces a real landscape PDF", async ({ page, tool }) => {
  await tool.open("images-to-pdf");
  await tool.upload([pngFixture]);
  await page.getByLabel("Orientation", { exact: true }).selectOption("landscape");
  await tool.process("Create PDF");
  const { bytes } = await tool.download();
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBe(1);
  expect(doc.getPage(0).getWidth()).toBeGreaterThan(doc.getPage(0).getHeight());
});
test("PDF to images produces actual PNG data", async ({ page, tool }) => {
  await tool.open("pdf-to-image");
  await tool.upload([await pdfFixture(2)]);
  await page.getByLabel("Pages", { exact: true }).fill("2");
  await tool.process("Convert to images");
  const { bytes, name } = await tool.download();
  expect(name).toMatch(/page-2\.png$/);
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
});
test("rejects disguised and oversized uploads", async ({ page, tool }) => {
  await tool.open("merge-pdf");
  await tool.upload([
    {
      name: "fake.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("<script>alert(1)</script>"),
    },
  ]);
  await expect(page.locator(".error[role=alert]")).toContainText("signature");
  const large = Buffer.alloc(26 * 1024 * 1024);
  large.write("%PDF-");
  await tool.upload([{ name: "large.pdf", mimeType: "application/pdf", buffer: large }]);
  await expect(page.locator(".error[role=alert]")).toContainText("25 MB");
});
test("mobile layout opens navigation without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("link", { name: "PDF tools", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/mobile-overview.png", fullPage: true });
});
