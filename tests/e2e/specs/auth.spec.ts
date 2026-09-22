import { test, expect } from "@playwright/test";
import { pdfFixture } from "../utils/documents";
const origin = { origin: "http://localhost:3000" };
test("registration, persistence, ownership checks, deletion and logout", async ({
  page,
  request,
  playwright,
}) => {
  const email = `e2e-${crypto.randomUUID()}@example.test`;
  const password = "docucore-test-password-2026";
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Test Person");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/dashboard/);
  const api = page.request;
  const session = await api.get("/api/auth/session");
  expect((await session.json()).user.email).toBe(email);
  expect((await api.get("/api/admin")).status()).toBe(403);
  const pdf = await pdfFixture(2);
  const saved = await api.post("/api/files/upload", {
    headers: origin,
    multipart: { file: pdf, save: "true" },
  });
  expect(saved.status()).toBe(201);
  const { file } = await saved.json();
  await page.goto("/files");
  await expect(page.getByText("sample.pdf", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("sample.pdf", { exact: true })).toBeVisible();
  expect((await request.get(`/api/files/${file.id}`)).status()).toBe(401);
  const other = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
    extraHTTPHeaders: origin,
  });
  const otherEmail = `other-${crypto.randomUUID()}@example.test`;
  await other.post("/api/auth/register", {
    data: { email: otherEmail, name: "Other Person", password },
  });
  expect((await other.get(`/api/files/${file.id}`)).status()).toBe(404);
  expect((await other.delete(`/api/files/${file.id}`)).status()).toBe(404);
  await other.delete("/api/account", { data: { password } });
  await other.dispose();
  expect(
    (
      await api.delete(`/api/files/${file.id}`, { headers: { origin: "https://evil.example" } })
    ).status(),
  ).toBe(403);
  expect((await api.delete(`/api/files/${file.id}`, { headers: origin })).status()).toBe(200);
  expect((await api.get(`/api/files/${file.id}`)).status()).toBe(404);
  expect((await api.post("/api/auth/logout", { headers: origin })).status()).toBe(200);
  expect((await api.get("/api/files")).status()).toBe(401);
  const login = await api.post("/api/auth/login", {
    headers: origin,
    data: { email, password, remember: true },
  });
  expect(login.status()).toBe(200);
  const cookies = await page.context().cookies();
  const cookie = cookies.find((c) => c.name === "docucore-session");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  expect((await api.delete("/api/account", { headers: origin, data: { password } })).status()).toBe(
    200,
  );
});
test("unauthenticated APIs and CSRF are blocked", async ({ request }) => {
  expect((await request.get("/api/admin")).status()).toBe(401);
  expect((await request.get("/api/files")).status()).toBe(401);
  expect(
    (
      await request.post("/api/auth/register", {
        data: { email: "x@example.test", name: "X", password: "long-enough-password" },
      })
    ).status(),
  ).toBe(403);
});
