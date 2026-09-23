import { scenario, expect } from "../support/scenario";
const colours = [
  "#000000",
  "#ffffff",
  "#ff0000",
  "#00ff00",
  "#0000ff",
  "#ffff00",
  "#808080",
  "#ff00ff",
];
let id = 0;
for (const mode of ["light", "dark"])
  for (const colour of colours) {
    scenario(
      `DC-BUTTON-${String(++id).padStart(3, "0")}`,
      "appearance",
      `${colour} custom buttons in ${mode}`,
      "settings with workspace colours",
      `choose custom ${colour} then restore workspace colour`,
      "button contrast is at least 4.5:1 and reset removes the override",
      async ({ page }) => {
        await page.goto("/settings");
        await page.getByRole("combobox", { name: "Display mode", exact: true }).selectOption(mode);
        await page
          .getByRole("combobox", { name: "Button colour", exact: true })
          .selectOption("custom");
        await page.getByLabel("Choose button colour", { exact: true }).fill(colour);
        await expect(page.locator("html")).toHaveClass(/custom-buttons/);
        const rgb = [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16));
        await expect(page.getByRole("button", { name: "Save appearance" })).toHaveCSS(
          "background-color",
          `rgb(${rgb.join(", ")})`,
        );
        const contrast = await page
          .getByRole("button", { name: "Save appearance" })
          .evaluate((el) => {
            const s = getComputedStyle(el);
            const l = (c: string) => {
              const a = c
                .match(/[\d.]+/g)!
                .slice(0, 3)
                .map(Number)
                .map((v) => {
                  v /= 255;
                  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
                });
              return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
            };
            const a = l(s.color),
              b = l(s.backgroundColor);
            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          });
        expect(contrast).toBeGreaterThanOrEqual(4.5);
        await page.reload();
        await expect(page.getByLabel("Choose button colour", { exact: true })).toHaveValue(colour);
        await page
          .getByRole("combobox", { name: "Button colour", exact: true })
          .selectOption("theme");
        await expect(page.locator("html")).not.toHaveClass(/custom-buttons/);
      },
    );
  }
