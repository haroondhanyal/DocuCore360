import { test, expect, type Page } from "@playwright/test";
export { test, expect };
export function scenario(
  id: string,
  category: string,
  title: string,
  given: string,
  when: string,
  then: string,
  run: (args: { page: Page }) => Promise<void>,
) {
  test(
    `${id} ${title}`,
    {
      tag: `@${category}`,
      annotation: [
        { type: "Given", description: given },
        { type: "When", description: when },
        { type: "Then", description: then },
      ],
    },
    async ({ page }) => {
      await test.step(`Given ${given}`, async () => {
        expect(page.isClosed()).toBe(false);
      });
      await test.step(`When ${when}; Then ${then}`, async () => run({ page }));
    },
  );
}
