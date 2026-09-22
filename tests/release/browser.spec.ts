import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { pdfFixture } from "../e2e/utils/documents";
import { readFile } from "node:fs/promises";
test("core PDF merge exports correctly across browser engines", async ({ page }) => {
  await page.goto("/tools/merge-pdf");
  await page
    .getByLabel("Choose files", { exact: true })
    .setInputFiles([await pdfFixture(1, "a.pdf"), await pdfFixture(2, "b.pdf")]);
  await page.getByRole("button", { name: "Merge PDFs", exact: true }).click();
  await expect(page.getByText("Your document is ready.", { exact: true })).toBeVisible({
    timeout: 45000,
  });
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download result", exact: true }).click();
  const download = await waiting;
  expect((await PDFDocument.load(await readFile((await download.path())!))).getPageCount()).toBe(3);
});
