import { test, expect } from "../fixtures/test";
import { pdfFixture } from "../utils/documents";
import { PDFDocument } from "pdf-lib";
test("PDF editor adds text, supports history, and exports searchable annotations", async ({
  page,
  tool,
}) => {
  await tool.open("edit-pdf");
  await tool.upload([await pdfFixture(2)]);
  const textTool = page.getByRole("button", { name: "Text", exact: true });
  await expect(textTool).toBeEnabled();
  await textTool.click();
  await page.locator(".upper-canvas").click({ position: { x: 70, y: 100 } });
  await page.getByLabel("Text content", { exact: true }).fill("Hello editor");
  await expect(page.getByText("Page 1 of 2 · 1 objects", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo edit", exact: true }).click();
  await page.getByRole("button", { name: "Redo edit", exact: true }).click();
  await expect(page.getByRole("button", { name: "Export PDF", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  await expect(page.getByText("Your document is ready.")).toBeVisible();
  const { bytes } = await tool.download();
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  await tool.open("pdf-reader");
  await tool.upload([{ name: "edited.pdf", mimeType: "application/pdf", buffer: bytes }]);
  await page.getByRole("button", { name: "Search document" }).click();
  await page.getByLabel("Find in document").fill("Hello editor");
  await expect(page.getByText("1 of 1 · page 1")).toBeVisible();
});
test("editor masks detected text honestly and rotates annotations with a page", async ({
  page,
  tool,
}) => {
  await tool.open("edit-pdf");
  await tool.upload([await pdfFixture(1)]);
  await page.getByRole("button", { name: "Existing text", exact: true }).click();
  await expect(page.getByText(/This is not redaction/)).toBeVisible();
  await page
    .getByRole("button", { name: "Edit existing text: DocuCore sample page 1", exact: true })
    .click();
  await page.getByLabel("Text content", { exact: true }).fill("Replacement overlay");
  await page.getByRole("button", { name: "Rotate editor page", exact: true }).click();
  await expect(page.getByRole("button", { name: "Export PDF", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  await expect(page.getByText("Your document is ready.")).toBeVisible();
  const { bytes } = await tool.download();
  expect((await PDFDocument.load(bytes)).getPage(0).getRotation().angle).toBe(90);
});
test("editor inserts shapes and a typed signature, then preserves edits across pages", async ({
  page,
  tool,
}) => {
  await tool.open("edit-pdf");
  await tool.upload([await pdfFixture(2)]);
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await page.getByRole("button", { name: "Sign", exact: true }).click();
  await page.getByRole("button", { name: "Type", exact: true }).click();
  await page.getByLabel("Signature name").fill("Jane Doe");
  await page.getByRole("button", { name: "Add signature", exact: true }).click();
  await expect(page.getByText("Page 1 of 2 · 2 objects", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit page 2", exact: true }).click();
  await page.getByRole("button", { name: "Edit page 1", exact: true }).click();
  await expect(page.getByText("Page 1 of 2 · 2 objects", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Duplicate editor page", exact: true }).click();
  await expect(page.getByRole("button", { name: "Export PDF", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  await expect(page.getByText("Your document is ready.")).toBeVisible();
  expect((await PDFDocument.load((await tool.download()).bytes)).getPageCount()).toBe(3);
});
