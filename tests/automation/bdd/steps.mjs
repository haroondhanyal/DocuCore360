import {
  BeforeAll,
  AfterAll,
  Before,
  After,
  Given,
  When,
  Then,
  setDefaultTimeout,
} from "@cucumber/cucumber";
import { chromium, expect } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
setDefaultTimeout(30000);
let browser;
BeforeAll(async () => {
  browser = await chromium.launch();
});
AfterAll(async () => {
  await browser?.close();
});
Before(async function ({ pickle }) {
  this.evidence = `automation-results/bdd-evidence/${pickle.name.match(/DC-BDD-\d+/)[0]}`;
  mkdirSync(this.evidence, { recursive: true });
  this.context = await browser.newContext({
    baseURL: "http://localhost:3000",
    recordVideo: { dir: this.evidence },
  });
  await this.context.tracing.start({ screenshots: true, snapshots: true });
  this.page = await this.context.newPage();
});
After(async function () {
  const video = this.page?.video();
  try {
    if (this.page && !this.page.isClosed())
      await this.attach(await this.page.screenshot({ fullPage: true }), "image/png");
    if (this.context) {
      await this.context.tracing.stop({ path: `${this.evidence}/trace.zip` });
      await this.attach(readFileSync(`${this.evidence}/trace.zip`), "application/zip");
    }
  } finally {
    await this.context?.close();
    if (video) await this.attach(readFileSync(await video.path()), "video/webm");
  }
});
Given("a clean browser on workspace settings", async function () {
  await this.page.goto("/settings");
  await expect(this.page.getByRole("heading", { name: "Workspace settings" })).toBeVisible();
});
When("I choose display mode {string} and workspace colour {string}", async function (mode, accent) {
  await this.page.getByRole("combobox", { name: "Display mode", exact: true }).selectOption(mode);
  await this.page
    .getByRole("combobox", { name: "Workspace colour theme", exact: true })
    .selectOption(accent);
});
Then("the displayed mode is {string} and palette is {string}", async function (mode, accent) {
  await expect(this.page.locator("html")).toHaveAttribute("data-display", mode);
  await expect(this.page.locator("html")).toHaveAttribute("data-accent", accent);
  this.surface = await this.page
    .locator(".sidebar")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
});
When("I reload the workspace", async function () {
  await this.page.reload();
});
Then("the saved mode is {string} and palette is {string}", async function (mode, accent) {
  await expect(this.page.getByRole("combobox", { name: "Display mode", exact: true })).toHaveValue(
    mode,
  );
  await expect(
    this.page.getByRole("combobox", { name: "Workspace colour theme", exact: true }),
  ).toHaveValue(accent);
  await expect(this.page.locator(".sidebar")).toHaveCSS("background-color", this.surface);
});
