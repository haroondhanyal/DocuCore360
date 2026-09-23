import { test, expect } from "../support/scenario";
import type { APIRequestContext } from "@playwright/test";
import { pdfFixture } from "../../e2e/utils/documents";
const headers = { origin: "http://localhost:3000" };
const password = "automation-validation-2026";
const profile: [string, Record<string, unknown>][] = [
  ["short name", { name: "a" }],
  ["long name", { name: "a".repeat(81) }],
  ["blank name", { name: "  " }],
  ["invalid email", { email: "not-an-email" }],
  ["short handle", { username: "ab" }],
  ["handle spaces", { username: "bad handle" }],
  ["handle punctuation", { username: "user!" }],
  ["long handle", { username: "a".repeat(49) }],
  ["invalid label", { sidebarLabel: "owner" }],
  ["invalid mode", { theme: "rainbow" }],
  ["invalid accent", { accent: "cyan" }],
  ["invalid colour", { buttonColor: "red" }],
  ["short hex", { buttonColor: "#fff" }],
  ["string contrast", { contrast: "true" }],
  ["string header", { colorfulHeader: "true" }],
  ["bad phone", { phone: "abc" }],
  ["long bio", { bio: "a".repeat(501) }],
  ["long location", { location: "a".repeat(101) }],
  ["long job title", { jobTitle: "a".repeat(81) }],
  ["password without confirmation", { newPassword: "new-password-2026" }],
];
const registration: [string, Record<string, unknown>][] = [
  ["missing email", { email: undefined }],
  ["malformed email", { email: "bad" }],
  ["empty email", { email: "" }],
  ["overlong email", { email: `${"a".repeat(255)}@example.test` }],
  ["missing password", { password: undefined }],
  ["short password", { password: "123456789" }],
  ["long password", { password: "a".repeat(129) }],
  ["missing name", { name: undefined }],
  ["blank name", { name: " " }],
  ["short name", { name: "a" }],
  ["long name", { name: "a".repeat(81) }],
  ["invalid remember", { remember: "yes" }],
];
const folders: [string, Record<string, unknown>][] = [
  ["missing name", {}],
  ["empty name", { name: "" }],
  ["blank name", { name: " " }],
  ["long name", { name: "a".repeat(81) }],
  ["numeric name", { name: 12 }],
  ["invalid parent", { name: "Test", parentId: "bad" }],
  ["numeric parent", { name: "Test", parentId: 5 }],
  ["array parent", { name: "Test", parentId: [] }],
];
test.describe("Input validation", () => {
  let api: APIRequestContext;
  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      extraHTTPHeaders: headers,
    });
    expect(
      (
        await api.post("/api/auth/register", {
          data: {
            email: `validation-${crypto.randomUUID()}@example.test`,
            password,
            name: "Validation fixture",
          },
        })
      ).status(),
    ).toBe(200);
  });
  test.afterAll(async () => {
    if (api) {
      expect((await api.delete("/api/account", { data: { password } })).status()).toBe(200);
      await api.dispose();
    }
  });
  for (const [i, [label, data]] of profile.entries())
    test(
      `DC-PROFILE-VAL-${String(i + 1).padStart(3, "0")} rejects ${label}`,
      { tag: "@validation" },
      async () => {
        await test.step(`Given a signed-in user, When saving ${label}, Then return 400`, async () => {
          const r = await api.patch("/api/account", { data });
          expect(r.status()).toBe(400);
          expect((await r.json()).error).toBeTruthy();
        });
      },
    );
  for (const [i, [label, data]] of registration.entries())
    test(
      `DC-AUTH-VAL-${String(i + 1).padStart(3, "0")} registration rejects ${label}`,
      { tag: "@validation" },
      async ({ request }) => {
        await test.step(`Given a guest, When registering with ${label}, Then reject input`, async () => {
          const r = await request.post("/api/auth/register", {
            headers,
            data: {
              email: `invalid-${crypto.randomUUID()}@example.test`,
              password,
              name: "Invalid fixture",
              ...data,
            },
          });
          expect(r.status()).toBe(400);
          expect((await r.json()).error).toBeTruthy();
        });
      },
    );
  for (const [i, [label, data]] of folders.entries())
    test(
      `DC-FOLDER-VAL-${String(i + 1).padStart(3, "0")} folder rejects ${label}`,
      { tag: "@validation" },
      async () => {
        await test.step(`Given a signed-in user, When creating folder with ${label}, Then reject input`, async () => {
          expect((await api.post("/api/folders", { data })).status()).toBe(400);
        });
      },
    );
  const cases = [
    "JSON instead of multipart",
    "no file",
    "no consent",
    "false consent",
    "unsupported extension",
    "empty file",
    "wrong signature",
    "invalid replacement ID",
  ];
  for (const [i, label] of cases.entries())
    test(
      `DC-UPLOAD-VAL-${String(i + 1).padStart(3, "0")} rejects ${label}`,
      { tag: "@validation" },
      async () => {
        await test.step(`Given a signed-in user, When uploading ${label}, Then reject without saving`, async () => {
          const f = await pdfFixture(1);
          let r;
          if (i === 0) r = await api.post("/api/files/upload", { data: {} });
          else {
            const multipart: Record<string, string | typeof f> = { save: "true", file: f };
            if (i === 1) delete multipart.file;
            if (i === 2) delete multipart.save;
            if (i === 3) multipart.save = "false";
            if (i === 4) multipart.file = { ...f, name: "bad.exe" };
            if (i === 5) multipart.file = { ...f, buffer: Buffer.alloc(0) };
            if (i === 6) multipart.file = { ...f, buffer: Buffer.from("not a PDF") };
            if (i === 7) multipart.replaceId = "invalid";
            r = await api.post("/api/files/upload", { multipart });
          }
          expect(r.status()).toBe(400);
          expect((await (await api.get("/api/files")).json()).files).toHaveLength(0);
        });
      },
    );
});
