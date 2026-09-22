import { test, expect } from "../fixtures/test";
import { pdfFixture, pngFixture } from "../utils/documents";
import AxeBuilder from "@axe-core/playwright";
const origin = { origin: "http://localhost:3000" };
test("account drafts are private, restore across sessions, and reject stale revisions", async ({
  page,
  playwright,
}) => {
  const email = `draft-${crypto.randomUUID()}@example.test`,
    password = "draft-test-password-2026";
  await page.request.post("/api/auth/register", {
    headers: origin,
    data: { email, name: "Draft fixture", password },
  });
  const other = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
    extraHTTPHeaders: origin,
  });
  try {
    await other.post("/api/auth/register", {
      data: { email: `other-${crypto.randomUUID()}@example.test`, name: "Other", password },
    });
    const pdf = await pdfFixture(1);
    const payload = {
      name: "Cloud source.pdf",
      source: pdf.buffer.toString("base64"),
      pages: [
        {
          id: "page-1",
          sourcePage: 0,
          rotation: 0,
          width: 595,
          height: 842,
          overlay: { objects: [] },
        },
      ],
    };
    const created = await page.request.post("/api/drafts", { headers: origin, data: payload });
    expect(created.status()).toBe(201);
    const { id, revision } = await created.json();
    expect((await other.get(`/api/drafts/${id}`)).status()).toBe(404);
    expect(
      (
        await page.request.put(`/api/drafts/${id}`, {
          headers: origin,
          data: { ...payload, revision },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await page.request.put(`/api/drafts/${id}`, {
          headers: origin,
          data: { ...payload, revision },
        })
      ).status(),
    ).toBe(409);
    await page.goto("/tools/edit-pdf");
    await page.getByLabel("Account draft", { exact: true }).selectOption(id);
    await page.getByRole("button", { name: "Restore account draft", exact: true }).click();
    await expect(page.locator(".editor-shell")).toBeVisible();
    await page.getByRole("button", { name: "Save account draft", exact: true }).click();
    await expect(page.getByText("Account draft saved · revision 3", { exact: true })).toBeVisible();
    await page.reload();
    await page.getByLabel("Account draft", { exact: true }).selectOption(id);
    await page.getByRole("button", { name: "Restore account draft", exact: true }).click();
    await expect(page.locator(".editor-shell")).toBeVisible();
  } finally {
    await page.request.delete("/api/account", { headers: origin, data: { password } });
    await other.delete("/api/account", { data: { password } });
    await other.dispose();
  }
});
test("nested folders reject descendant moves and file pagination has stable metadata", async ({
  page,
}) => {
  const password = "folder-release-password-2026";
  await page.request.post("/api/auth/register", {
    headers: origin,
    data: { email: `nested-${crypto.randomUUID()}@example.test`, name: "Nested fixture", password },
  });
  try {
    const parent = await (
      await page.request.post("/api/folders", { headers: origin, data: { name: "Parent" } })
    ).json();
    const child = await (
      await page.request.post("/api/folders", {
        headers: origin,
        data: { name: "Child", parentId: parent.id },
      })
    ).json();
    expect(child.parentId).toBe(parent.id);
    expect(
      (
        await page.request.patch("/api/folders", {
          headers: origin,
          data: { id: parent.id, parentId: child.id },
        })
      ).status(),
    ).toBe(400);
    const peer = await (
      await page.request.post("/api/folders", { headers: origin, data: { name: "Peer" } })
    ).json();
    const moves = await Promise.all([
      page.request.patch("/api/folders", {
        headers: origin,
        data: { id: parent.id, parentId: peer.id },
      }),
      page.request.patch("/api/folders", {
        headers: origin,
        data: { id: peer.id, parentId: parent.id },
      }),
    ]);
    expect(moves.map((r) => r.status()).sort()).toEqual([200, 400]);
    const list = await (await page.request.get("/api/files?page=1")).json();
    expect(list.pageSize).toBe(50);
    expect(list.total).toBe(0);
    expect((await page.request.get("/api/files?page=-1")).status()).toBe(400);
  } finally {
    await page.request.delete("/api/account", { headers: origin, data: { password } });
  }
});
test("visual redaction marks multiple areas and drawing exports", async ({ page, tool }) => {
  await tool.open("redact-pdf");
  await tool.upload([await pdfFixture(1)]);
  const canvas = page.getByLabel("Redaction page preview");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await canvas.evaluate((c) => c.scrollIntoView({ block: "start" }));
  const box = (await canvas.boundingBox())!;
  for (const y of [50, 100]) {
    await page.mouse.move(box.x + 30, box.y + y);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + y + 30, { steps: 3 });
    await page.mouse.up();
  }
  await expect(page.getByRole("button", { name: "Remove region 2", exact: true })).toBeVisible();
  await tool.process("Process PDF");
  await tool.open("image-editor");
  await tool.upload([pngFixture]);
  await page.getByLabel("Canvas tool").selectOption("draw");
  await page.getByLabel("Image preview").evaluate((c) => c.scrollIntoView({ block: "start" }));
  const img = (await page.getByLabel("Image preview").boundingBox())!;
  await page.mouse.move(img.x + 10, img.y + 10);
  await page.mouse.down();
  await page.mouse.move(img.x + 100, img.y + 80, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByText("Drawing layers (1)", { exact: true })).toBeVisible();
  await tool.process("Export images");
});
test("multilingual OCR exposes local language choices and Urdu text PDF embeds a font", async ({
  page,
  tool,
}) => {
  await tool.open("ocr");
  await page.getByLabel("OCR language").selectOption("urd");
  await expect(page.getByLabel("OCR language")).toHaveValue("urd");
  expect((await page.request.get("/ocr/urd.traineddata.gz")).status()).toBe(200);
  await tool.open("text-to-pdf");
  await page.getByLabel("Or paste content").fill("اردو دستاویز");
  await tool.process("Convert document");
  expect((await tool.download()).bytes.length).toBeGreaterThan(1000);
});
test("overview and authentication have no serious or critical accessibility violations", async ({
  page,
}) => {
  for (const route of ["/", "/login", "/tools"]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations
        .filter((v) => ["critical", "serious"].includes(v.impact ?? ""))
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
  }
});
