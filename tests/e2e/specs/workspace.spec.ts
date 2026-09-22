import { test, expect } from "@playwright/test";
import { pdfFixture } from "../utils/documents";
const headers = { origin: "http://localhost:3000" };
test("folders, favorites, snapshots and history enforce ownership", async ({
  page,
  playwright,
}) => {
  const password = "workspace-test-password-2026";
  const email = `workspace-${crypto.randomUUID()}@example.test`;
  const api = page.request;
  expect(
    (
      await api.post("/api/auth/register", {
        headers,
        data: { name: "Workspace Test", email, password },
      })
    ).status(),
  ).toBe(200);
  const other = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
    extraHTTPHeaders: headers,
  });
  try {
    await other.post("/api/auth/register", {
      data: { name: "Other", email: `other-${crypto.randomUUID()}@example.test`, password },
    });
    const folder = await (
      await api.post("/api/folders", { headers, data: { name: "Invoices" } })
    ).json();
    const saved = await (
      await api.post("/api/files/upload", {
        headers,
        multipart: { file: await pdfFixture(1), save: "true" },
      })
    ).json();
    const id = saved.file.id;
    expect(
      (
        await api.patch(`/api/files/${id}`, {
          headers,
          data: { folderId: folder.id, favorite: true },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await other.patch(`/api/files/${id}`, { data: { folderId: folder.id } })).status(),
    ).toBe(404);
    const ownOther = await (
      await other.post("/api/files/upload", {
        multipart: { file: await pdfFixture(1), save: "true" },
      })
    ).json();
    expect(
      (
        await other.patch(`/api/files/${ownOther.file.id}`, { data: { folderId: folder.id } })
      ).status(),
    ).toBe(404);
    expect(
      (
        await api.post(`/api/files/${id}/versions`, { headers, data: { label: "Original" } })
      ).status(),
    ).toBe(200);
    const versions = await (await api.get(`/api/files/${id}/versions`)).json();
    expect(versions.versions).toHaveLength(1);
    expect((await other.get(`/api/files/${id}/versions`)).status()).toBe(404);
    expect(
      (
        await api.patch(`/api/files/${id}/versions`, {
          headers,
          data: { id: versions.versions[0].id },
        })
      ).status(),
    ).toBe(200);
    await page.goto("/files");
    await expect(page.getByLabel("Filter folder")).toBeVisible();
    await page.getByLabel("Filter folder").selectOption(folder.id);
    await expect(page.getByText("sample.pdf", { exact: true })).toBeVisible();
    await api.post("/api/history", {
      headers,
      data: {
        tool: "merge-pdf",
        inputName: "",
        outputName: "combined.pdf",
        durationMs: 0,
        success: true,
      },
    });
    await page.goto("/history");
    await expect(page.getByText("combined.pdf", { exact: true })).toBeVisible();
    expect((await other.get("/api/history")).status()).toBe(200);
    expect((await (await other.get("/api/history")).json()).history).toHaveLength(0);
    expect((await api.delete("/api/folders", { headers, data: { id: folder.id } })).status()).toBe(
      200,
    );
    const files = await (await api.get("/api/files")).json();
    expect(files.files[0].folderId).toBeNull();
    expect(files.files[0].favorite).toBe(true);
  } finally {
    await api.delete("/api/account", { headers, data: { password } });
    await other.delete("/api/account", { data: { password } });
    await other.dispose();
  }
});

test("admin health, role boundary and disabling sessions", async ({ playwright }) => {
  const { config } = await import("dotenv");
  config({ quiet: true });
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const admin = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
    extraHTTPHeaders: headers,
  });
  const user = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
    extraHTTPHeaders: headers,
  });
  const password = "admin-fixture-password-2026";
  const email = `admin-test-${crypto.randomUUID()}@example.test`;
  const otherEmail = `user-test-${crypto.randomUUID()}@example.test`;
  try {
    await admin.post("/api/auth/register", { data: { name: "Admin fixture", email, password } });
    await user.post("/api/auth/register", {
      data: { name: "User fixture", email: otherEmail, password },
    });
    const a = await db.user.update({ where: { email }, data: { role: "ADMIN" } });
    const u = await db.user.findUniqueOrThrow({ where: { email: otherEmail } });
    expect((await user.get("/api/admin")).status()).toBe(403);
    const health = await admin.get("/api/admin");
    expect(health.status()).toBe(200);
    expect((await health.json()).health.database).toBe(true);
    expect(
      (
        await admin.post("/api/admin", { data: { action: "user", id: a.id, disabled: true } })
      ).status(),
    ).toBe(400);
    expect(
      (
        await admin.post("/api/admin", { data: { action: "user", id: u.id, disabled: true } })
      ).status(),
    ).toBe(200);
    expect((await user.get("/api/files")).status()).toBe(401);
    expect(
      (await user.post("/api/auth/login", { data: { email: otherEmail, password } })).status(),
    ).toBe(403);
    expect(
      (
        await admin.post("/api/admin", { data: { action: "user", id: u.id, disabled: false } })
      ).status(),
    ).toBe(200);
    expect(
      (await user.post("/api/auth/login", { data: { email: otherEmail, password } })).status(),
    ).toBe(200);
    expect((await admin.post("/api/admin", { data: { action: "cleanup" } })).status()).toBe(200);
  } finally {
    await db.user.deleteMany({ where: { email: { in: [email, otherEmail] } } });
    await db.$disconnect();
    await admin.dispose();
    await user.dispose();
  }
});
