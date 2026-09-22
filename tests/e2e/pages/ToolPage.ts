import { expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
export class ToolPage {
  constructor(readonly page: Page) {}
  async open(slug: string) {
    await this.page.goto(`/tools/${slug}`);
    await expect(this.page.getByLabel("Choose files", { exact: true })).toBeAttached({
      timeout: 30000,
    });
  }
  async upload(files: { name: string; mimeType: string; buffer: Buffer }[]) {
    await this.page.getByLabel("Choose files", { exact: true }).setInputFiles(files);
  }
  async process(button: string) {
    const action = this.page.getByRole("button", { name: button, exact: true });
    await expect(action).toBeEnabled();
    await action.click();
    await expect(this.page.getByText("Your document is ready.")).toBeVisible({ timeout: 30_000 });
  }
  async download() {
    const event = this.page.waitForEvent("download");
    await this.page.getByRole("button", { name: "Download result" }).click();
    const file = await event;
    const path = await file.path();
    if (!path) throw new Error("Download did not produce a file.");
    return { bytes: await readFile(path), name: file.suggestedFilename() };
  }
}
