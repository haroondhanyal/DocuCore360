import { scenario, expect, test } from "../support/scenario";
import { tools } from "@/config/tools";
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
];
let routeId = 0;
for (const size of viewports)
  for (const tool of tools) {
    scenario(
      `DC-ROUTE-${String(++routeId).padStart(3, "0")}`,
      "responsive",
      `${tool.name} at ${size.name}`,
      "a guest at the selected viewport",
      `open ${tool.route}`,
      "tool input is available, navigation works and the page fits",
      async ({ page }) => {
        await page.setViewportSize(size);
        const response = await page.goto(tool.route);
        expect(response?.status()).toBe(200);
        await expect(page.getByLabel("Choose files", { exact: true })).toBeAttached();
        await expect(page.locator("h1")).toContainText(tool.name);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        const timing = await page.evaluate(() => {
          const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
          return {
            domContentLoadedMs: n.domContentLoadedEventEnd,
            loadMs: n.loadEventEnd,
            responseMs: n.responseEnd,
          };
        });
        expect(timing.domContentLoadedMs).toBeLessThan(15000);
        await test.info().attach("browser-timing", {
          body: JSON.stringify({ route: tool.route, viewport: size.name, ...timing }),
          contentType: "application/json",
        });
        if (size.name === "mobile") {
          await page.getByRole("button", { name: "Open menu", exact: true }).click();
        }
        await page
          .getByRole("navigation", { name: "Main navigation" })
          .getByRole("link", { name: /^All tools/ })
          .click();
        await expect(page).toHaveURL(/\/tools$/);
      },
    );
  }
for (const [i, tool] of tools.entries()) {
  scenario(
    `DC-SEARCH-${String(i + 1).padStart(3, "0")}`,
    "discovery",
    `Search locates ${tool.name}`,
    "the complete tool directory",
    `search for ${tool.name}`,
    "the matching card links to its tool and irrelevant cards are excluded",
    async ({ page }) => {
      await page.goto("/tools");
      await page.getByRole("textbox", { name: "Filter tools" }).fill(tool.name);
      const cards = page.locator(".tool-grid .tool-card");
      await expect(
        cards.filter({ has: page.getByRole("heading", { name: tool.name, exact: true }) }),
      ).toHaveCount(1);
      await page.getByRole("textbox", { name: "Filter tools" }).fill("no-such-docucore-tool-93827");
      await expect(cards).toHaveCount(0);
      await page.getByRole("textbox", { name: "Filter tools" }).fill(tool.name);
      await cards
        .filter({ has: page.getByRole("heading", { name: tool.name, exact: true }) })
        .getByRole("link")
        .click();
      await expect(page).toHaveURL(tool.route);
    },
  );
  scenario(
    `DC-FAV-${String(i + 1).padStart(3, "0")}`,
    "discovery",
    `Favorite lifecycle for ${tool.name}`,
    "a clean guest browser",
    `favorite and unfavorite ${tool.name}`,
    "the favorite survives reload and explicit removal",
    async ({ page }) => {
      await page.goto("/tools");
      const card = page
        .locator(".tool-card")
        .filter({ has: page.getByRole("heading", { name: tool.name, exact: true }) });
      await card.getByRole("button").click();
      await page.goto("/favorites");
      await expect(page.getByRole("heading", { name: tool.name, exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByRole("heading", { name: tool.name, exact: true })).toBeVisible();
      await page.locator(".tool-card").getByRole("button").click();
      await expect(page.locator(".tool-card")).toHaveCount(0);
    },
  );
}
