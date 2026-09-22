import { test, expect } from "@playwright/test";
import { pngFixture } from "../utils/documents";
import sharp from "sharp";
import AxeBuilder from "@axe-core/playwright";
const origin = { origin: "http://localhost:3000" };
test("profile updates persist, avatars stay private, and email changes revoke sessions", async ({
  page,
  playwright,
}) => {
  let email = `profile-${crypto.randomUUID()}@example.test`;
  const password = "profile-test-password-2026";
  const other = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
    extraHTTPHeaders: origin,
  });
  const peerEmail = `peer-${crypto.randomUUID()}@example.test`;
  await page.request.post("/api/auth/register", {
    headers: origin,
    data: { email, password, name: "Profile Fixture" },
  });
  await other.post("/api/auth/register", {
    data: { email: peerEmail, password, name: "Other Profile" },
  });
  try {
    await page.goto("/");
    await page.getByLabel("Open your profile menu").click();
    await page.getByRole("link", { name: "View & edit profile" }).click();
    await expect(page.getByRole("heading", { name: "Your profile", exact: true })).toBeVisible();
    await page.getByLabel("Full name").fill("Updated Person");
    await page.getByLabel("Contact number").fill("+92 300 1234567");
    await page.getByLabel("Job title").fill("Designer");
    await page.getByLabel("Location").fill("Karachi, Pakistan");
    await page.getByLabel("About you").fill("I design useful documents.");
    await page.getByRole("button", { name: "Save profile", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("saved");
    await expect(page.getByLabel("Open your profile menu")).toContainText("Updated Person");
    await page.getByLabel("Upload profile photo").setInputFiles(pngFixture);
    await expect(page.getByRole("status")).toHaveText("Profile photo updated.");
    await expect(page.locator(".workspace-menu img")).toBeVisible();
    const avatar = await page.request.get("/api/account/avatar");
    expect(avatar.status()).toBe(200);
    expect(avatar.headers()["cache-control"]).toContain("no-store");
    const metadata = await sharp(await avatar.body()).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(512);
    expect((await other.get("/api/account/avatar")).status()).toBe(404);
    expect(
      (
        await page.request.put("/api/account/avatar", { headers: origin, data: "<svg></svg>" })
      ).status(),
    ).toBe(400);
    expect(
      (
        await page.request.put("/api/account/avatar", {
          headers: origin,
          data: Buffer.alloc(2 * 1024 * 1024 + 1),
        })
      ).status(),
    ).toBe(413);
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      accessibility.violations
        .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
        .map((v) => v.id),
    ).toEqual([]);
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: "docs/screenshots/profile-desktop.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.reload();
    await expect(page.getByLabel("Contact number")).toHaveValue("+92 300 1234567");
    await expect(page.getByLabel("About you")).toHaveValue("I design useful documents.");
    await page.getByRole("button", { name: "Remove photo" }).click();
    await expect(page.getByRole("status")).toHaveText("Profile photo removed.");
    expect((await page.request.get("/api/account/avatar")).status()).toBe(404);
    expect(
      (
        await page.request.patch("/api/account", {
          headers: origin,
          data: { email: peerEmail, currentPassword: password },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await page.request.patch("/api/account", {
          headers: origin,
          data: {
            email: `denied-${crypto.randomUUID()}@example.test`,
            currentPassword: "wrong-password",
          },
        })
      ).status(),
    ).toBe(400);
    const newEmail = `updated-${crypto.randomUUID()}@example.test`;
    await page.getByLabel("Email address", { exact: true }).fill(newEmail);
    await page.getByLabel("Current password (only to change email)").fill(password);
    await page.getByRole("button", { name: "Save profile", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Email changed.");
    email = newEmail;
    expect((await (await page.request.get("/api/auth/session")).json()).user).toBeNull();
    expect((await page.request.get("/api/account/avatar")).status()).toBe(401);
    expect(
      (
        await page.request.post("/api/auth/login", { headers: origin, data: { email, password } })
      ).status(),
    ).toBe(200);
    const account = (await (await page.request.get("/api/auth/session")).json()).user;
    expect(account.emailVerifiedAt).toBeNull();
    expect(account.name).toBe("Updated Person");
    await page.goto("/profile");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByLabel("Full name")).toBeVisible();
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      window.scrollTo(0, 0);
    });
    await expect
      .poll(async () => {
        const box = await page.locator(".sidebar").boundingBox();
        return box ? box.x + box.width : 0;
      })
      .toBeLessThanOrEqual(0);
    await page.screenshot({
      path: "docs/screenshots/profile-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  } finally {
    await page.request.post("/api/auth/login", { headers: origin, data: { email, password } });
    await page.request.delete("/api/account", { headers: origin, data: { password } });
    await other.delete("/api/account", { data: { password } });
    await other.dispose();
  }
});
