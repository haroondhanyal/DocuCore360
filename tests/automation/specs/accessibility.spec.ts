import AxeBuilder from "@axe-core/playwright";
import { scenario, expect, test } from "../support/scenario";
const routes = [
  "/",
  "/tools",
  "/favorites",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/settings",
  "/privacy",
  "/help",
  "/profile",
  "/records",
  "/profile/settings",
];
let id = 0;
for (const mode of ["light", "dark"])
  for (const route of routes) {
    scenario(
      `DC-A11Y-${String(++id).padStart(3, "0")}`,
      "accessibility",
      `${route} accessibility in ${mode}`,
      "a guest with the chosen appearance",
      `open ${route} and audit WCAG A/AA`,
      "no serious or critical violations and keyboard skip navigation works",
      async ({ page }) => {
        await page.goto("/settings");
        await page.getByRole("combobox", { name: "Display mode", exact: true }).selectOption(mode);
        await page.goto(route);
        await expect(page.locator("h1")).toBeVisible();
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        await test
          .info()
          .attach("accessibility", {
            body: JSON.stringify({
              route,
              mode,
              violations: results.violations.map((v) => ({
                id: v.id,
                impact: v.impact,
                targets: v.nodes.map((n) => n.target),
              })),
            }),
            contentType: "application/json",
          });
        expect(
          results.violations
            .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
            .map((v) => v.id),
        ).toEqual([]);
        await page.keyboard.press("Tab");
        await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/#main-content$/);
      },
    );
  }
