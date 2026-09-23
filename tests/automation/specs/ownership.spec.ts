import { test, expect, type APIRequestContext } from "@playwright/test";
import { pdfFixture } from "../../e2e/utils/documents";
let owner: APIRequestContext, peer: APIRequestContext;
let fileId: string, draftId: string, folderId: string;
const password = "ownership-regression-2026";
test.beforeAll(async ({ playwright }) => {
  for (const role of ["owner", "peer"]) {
    const api = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      extraHTTPHeaders: { origin: "http://localhost:3000" },
    });
    if (role === "owner") owner = api;
    else peer = api;
    expect(
      (
        await api.post("/api/auth/register", {
          data: {
            name: role,
            email: `ownership-${role}-${crypto.randomUUID()}@example.test`,
            password,
          },
        })
      ).status(),
    ).toBe(200);
  }
  folderId = (
    await (await owner.post("/api/folders", { data: { name: "Protected folder" } })).json()
  ).id;
  const pdf = await pdfFixture(1);
  fileId = (
    await (await owner.post("/api/files/upload", { multipart: { file: pdf, save: "true" } })).json()
  ).file.id;
  draftId = (
    await (
      await owner.post("/api/drafts", {
        data: {
          name: "Protected draft.pdf",
          source: pdf.buffer.toString("base64"),
          pages: [
            {
              id: "p1",
              sourcePage: 0,
              rotation: 0,
              width: 595,
              height: 842,
              overlay: { objects: [] },
            },
          ],
        },
      })
    ).json()
  ).id;
});
test.afterAll(async () => {
  for (const api of [owner, peer])
    if (api) {
      await api.delete("/api/account", { data: { password } });
      await api.dispose();
    }
});
const operations: [string, string, () => string, () => object][] = [
  ["file download", "GET", () => `/api/files/${fileId}`, () => ({})],
  ["file rename", "PATCH", () => `/api/files/${fileId}`, () => ({ name: "Stolen.pdf" })],
  ["file deletion", "DELETE", () => `/api/files/${fileId}`, () => ({})],
  ["version listing", "GET", () => `/api/files/${fileId}/versions`, () => ({})],
  ["version creation", "POST", () => `/api/files/${fileId}/versions`, () => ({ label: "Stolen" })],
  [
    "version restore",
    "PATCH",
    () => `/api/files/${fileId}/versions`,
    () => ({ id: crypto.randomUUID() }),
  ],
  ["draft reading", "GET", () => `/api/drafts/${draftId}`, () => ({})],
  ["draft replacement", "PUT", () => `/api/drafts/${draftId}`, () => ({ revision: 1 })],
  ["draft deletion", "DELETE", () => `/api/drafts/${draftId}`, () => ({})],
  ["folder rename", "PATCH", () => "/api/folders", () => ({ id: folderId, name: "Stolen" })],
];
for (const [i, [title, method, url, data]] of operations.entries())
  test(
    `DC-OWN-${String(i + 1).padStart(3, "0")} denies cross-account ${title}`,
    { tag: "@security" },
    async () => {
      await test.step("When another account targets an owned resource, deny access and preserve owner data", async () => {
        const r = await peer.fetch(url(), {
          method,
          ...(method === "GET" ? {} : { data: data() }),
        });
        expect(r.status()).toBe(404);
        expect((await owner.get(`/api/files/${fileId}`)).status()).toBe(200);
        expect((await owner.get(`/api/drafts/${draftId}`)).status()).toBe(200);
        expect((await (await owner.get("/api/folders")).json()).folders).toContainEqual(
          expect.objectContaining({ id: folderId, name: "Protected folder" }),
        );
      });
    },
  );
test("DC-OWN-011 foreign folder deletion is a harmless no-op", { tag: "@security" }, async () => {
  expect((await peer.delete("/api/folders", { data: { id: folderId } })).status()).toBe(200);
  expect((await (await owner.get("/api/folders")).json()).folders).toContainEqual(
    expect.objectContaining({ id: folderId }),
  );
});
test("DC-OWN-012 folder listing excludes other accounts", { tag: "@security" }, async () => {
  expect((await (await peer.get("/api/folders")).json()).folders).not.toContainEqual(
    expect.objectContaining({ id: folderId }),
  );
});
async function folder(name: string, parentId?: string) {
  const r = await owner.post("/api/folders", { data: { name, parentId } });
  expect(r.status()).toBe(200);
  return (await r.json()).id as string;
}
test(
  "DC-FOLDER-STATE-001 duplicate creation preserves original",
  { tag: "@validation" },
  async () => {
    const id = await folder("Duplicate");
    expect((await owner.post("/api/folders", { data: { name: "Duplicate" } })).status()).toBe(409);
    expect(
      (await (await owner.get("/api/folders")).json()).folders.filter(
        (f: { name: string }) => f.name === "Duplicate",
      ),
    ).toEqual([expect.objectContaining({ id })]);
  },
);
test(
  "DC-FOLDER-STATE-002 conflicting rename leaves both names",
  { tag: "@validation" },
  async () => {
    const id = await folder("Rename source");
    await folder("Rename target");
    expect(
      (await owner.patch("/api/folders", { data: { id, name: "Rename target" } })).status(),
    ).toBe(409);
    expect((await (await owner.get("/api/folders")).json()).folders).toContainEqual(
      expect.objectContaining({ id, name: "Rename source" }),
    );
  },
);
test("DC-FOLDER-STATE-003 self parenting rejected", { tag: "@validation" }, async () => {
  const id = await folder("Self parent");
  expect((await owner.patch("/api/folders", { data: { id, parentId: id } })).status()).toBe(400);
  expect((await (await owner.get("/api/folders")).json()).folders).toContainEqual(
    expect.objectContaining({ id, parentId: null }),
  );
});
test("DC-FOLDER-STATE-004 descendant cycle rejected", { tag: "@validation" }, async () => {
  const id = await folder("Cycle root");
  const child = await folder("Cycle child", id);
  expect((await owner.patch("/api/folders", { data: { id, parentId: child } })).status()).toBe(400);
  expect((await (await owner.get("/api/folders")).json()).folders).toContainEqual(
    expect.objectContaining({ id, parentId: null }),
  );
});
test("DC-FOLDER-STATE-005 cannot create under a foreign parent", { tag: "@security" }, async () => {
  expect(
    (
      await peer.post("/api/folders", { data: { name: "Forbidden child", parentId: folderId } })
    ).status(),
  ).toBe(404);
  expect((await (await peer.get("/api/folders")).json()).folders).toHaveLength(0);
});
test("DC-FOLDER-STATE-006 cannot move under a foreign parent", { tag: "@security" }, async () => {
  const id = (await (await peer.post("/api/folders", { data: { name: "Peer root" } })).json()).id;
  expect((await peer.patch("/api/folders", { data: { id, parentId: folderId } })).status()).toBe(
    404,
  );
  expect((await (await peer.get("/api/folders")).json()).folders).toContainEqual(
    expect.objectContaining({ id, parentId: null }),
  );
});
test(
  "DC-FOLDER-STATE-007 deleting parent retains child at root",
  { tag: "@validation" },
  async () => {
    const id = await folder("Delete parent");
    const child = await folder("Retained child", id);
    expect((await owner.delete("/api/folders", { data: { id } })).status()).toBe(200);
    expect((await (await owner.get("/api/folders")).json()).folders).toContainEqual(
      expect.objectContaining({ id: child, parentId: null }),
    );
  },
);
test(
  "DC-FOLDER-STATE-008 names normalize whitespace on create and rename",
  { tag: "@validation" },
  async () => {
    const id = await folder("  Trimmed folder  ");
    expect((await (await owner.get("/api/folders")).json()).folders).toContainEqual(
      expect.objectContaining({ id, name: "Trimmed folder" }),
    );
    expect(
      (await owner.patch("/api/folders", { data: { id, name: "  Trimmed rename  " } })).status(),
    ).toBe(200);
    expect((await (await owner.get("/api/folders")).json()).folders).toContainEqual(
      expect.objectContaining({ id, name: "Trimmed rename" }),
    );
  },
);
