import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { tools, matchesToolCategory } from "@/config/tools";
import { pdfFixture } from "../utils/documents";
const origin = { origin: "http://localhost:3000" };

test("sidebar categories, all tools and browser history stay in sync", async ({ page }) => {
  await page.goto("/tools");
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(page.locator(".tool-grid .tool-card")).toHaveCount(tools.length);
  await navigation.getByRole("link", { name: "PDF tools", exact: true }).click();
  await expect(page.getByRole("heading", { name: "PDF tools", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "PDF tools", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator(".tool-grid .tool-card")).toHaveCount(
    tools.filter((t) => matchesToolCategory(t, "PDF")).length,
  );
  await expect(
    page.locator(".tool-grid").getByRole("heading", { name: "Image Editor", exact: true }),
  ).toHaveCount(0);
  await navigation.getByRole("link", { name: "Image tools", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Image tools", exact: true })).toBeVisible();
  await expect(page.locator(".tool-grid .tool-card")).toHaveCount(
    tools.filter((t) => matchesToolCategory(t, "Image")).length,
  );
  await page.goBack();
  await expect(page.getByRole("heading", { name: "PDF tools", exact: true })).toBeVisible();
  await navigation.getByRole("link", { name: /^All tools/ }).click();
  await expect(page.locator(".tool-grid .tool-card")).toHaveCount(tools.length);
  await page.getByRole("button", { name: "Security", exact: true }).click();
  await expect(page).toHaveURL(/category=Security/);
  await expect(navigation.getByRole("link", { name: "Sign & protect" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("password visibility works without submitting, and account password lives in profile settings", async ({
  page,
}) => {
  await page.goto("/register");
  const password = "visibility-test-password-2026";
  const email = `visibility-${crypto.randomUUID()}@example.test`;
  await page.getByLabel("Your name").fill("Visibility fixture");
  await page.getByLabel("Email address").fill(email);
  const input = page.getByLabel("Password", { exact: true });
  await input.fill(password);
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(input).toHaveAttribute("type", "text");
  await expect(page).toHaveURL(/register/);
  await page.getByRole("button", { name: "Hide password", exact: true }).click();
  await expect(input).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/dashboard/);
  let current = password;
  try {
    await page.getByLabel("Open your profile menu").click();
    await page
      .locator(".workspace-menu")
      .getByRole("link", { name: "Account settings", exact: true })
      .click();
    await expect(page).toHaveURL(/profile\/settings/);
    const field = page.getByLabel("Current password", { exact: true });
    await field.fill(password);
    await page
      .locator(".password-control")
      .first()
      .getByRole("button", { name: "Show password" })
      .click();
    await expect(field).toHaveAttribute("type", "text");
    await page.getByLabel("New password", { exact: true }).fill("updated-visibility-password-2026");
    await page.getByRole("button", { name: "Update password", exact: true }).click();
    await expect(page).toHaveURL(/login/);
    current = "updated-visibility-password-2026";
    expect(
      (
        await page.request.post("/api/auth/login", { headers: origin, data: { email, password } })
      ).status(),
    ).toBe(401);
    expect(
      (
        await page.request.post("/api/auth/login", {
          headers: origin,
          data: { email, password: current },
        })
      ).status(),
    ).toBe(200);
    await page.goto("/profile/settings");
    await page.getByRole("button", { name: "Delete account", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Password", { exact: true }).fill(current);
    await dialog.getByRole("button", { name: "Show password", exact: true }).click();
    await expect(dialog.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  } finally {
    await page.request.post("/api/auth/login", {
      headers: origin,
      data: { email, password: current },
    });
    await page.request.delete("/api/account", { headers: origin, data: { password: current } });
  }
  await page.goto("/tools/protect-pdf");
  await page.getByLabel("Choose files", { exact: true }).setInputFiles(await pdfFixture(1));
  await page.getByLabel("Document password").fill("document-password-2026");
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(page.getByLabel("Document password")).toHaveAttribute("type", "text");
});

test("all eight accents preview, save to the account and expose only owned records", async ({
  page,
  browser,
}) => {
  const email = `appearance-${crypto.randomUUID()}@example.test`,
    password = "appearance-test-password-2026";
  await page.request.post("/api/auth/register", {
    headers: origin,
    data: { email, password, name: "Appearance fixture" },
  });
  try {
    await page.goto("/settings");
    await page.getByRole("combobox", { name: "Color theme", exact: true }).selectOption("light");
    for (const name of ["Emerald", "Blue", "Purple", "Rose", "Red", "Orange", "Teal", "Gray"]) {
      await page.getByRole("button", { name: `${name} accent`, exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("data-accent", name.toLowerCase());
    }
    await page.getByRole("button", { name: "Purple accent", exact: true }).click();
    await page.getByRole("combobox", { name: "Color theme", exact: true }).selectOption("dark");
    await page.getByLabel("High contrast", { exact: true }).check();
    await page.getByLabel("Colorful header and buttons", { exact: true }).check();
    await page.getByRole("button", { name: "Save appearance", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("saved to your account");
    const a11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      a11y.violations
        .filter((v) => ["critical", "serious"].includes(v.impact ?? ""))
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: "docs/screenshots/appearance-dark-purple.png",
      fullPage: true,
      animations: "disabled",
    });
    const context = await browser.newContext();
    try {
      const fresh = await context.newPage();
      await context.request.post("http://localhost:3000/api/auth/login", {
        headers: origin,
        data: { email, password },
      });
      await fresh.goto("http://localhost:3000/settings");
      await expect(fresh.locator("html")).toHaveAttribute("data-accent", "purple");
      await expect(fresh.locator("html")).toHaveClass(/dark/);
      await expect(fresh.getByLabel("High contrast", { exact: true })).toBeChecked();
      await expect(fresh.getByLabel("Colorful header and buttons", { exact: true })).toBeChecked();
    } finally {
      await context.close();
    }
    const pdf = await pdfFixture(1, "owned-record.pdf");
    await page.request.post("/api/files/upload", {
      headers: origin,
      multipart: { file: pdf, save: "true" },
    });
    await page.getByRole("link", { name: "View all records", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "All your records", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("owned-record.pdf", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Account drafts", exact: true }).click();
    await expect(page.getByText("No account drafts saved yet.")).toBeVisible();
    await page.getByRole("button", { name: "Processing history", exact: true }).click();
    await expect(page.getByText("No recorded results yet.")).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  } finally {
    await page.request.delete("/api/account", { headers: origin, data: { password } });
  }
});
