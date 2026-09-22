import { test as base } from "@playwright/test";
import { ToolPage } from "../pages/ToolPage";
export const test = base.extend<{ tool: ToolPage }>({
  tool: async ({ page }, provide) => {
    await provide(new ToolPage(page));
  },
});
export { expect } from "@playwright/test";
