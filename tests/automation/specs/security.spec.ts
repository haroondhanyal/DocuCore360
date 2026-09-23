import { test, expect } from "../support/scenario";
const id = "00000000-0000-4000-8000-000000000001";
const guest: [string, string][] = [
  ["GET", "/api/files"],
  ["GET", "/api/folders"],
  ["GET", "/api/favorites"],
  ["GET", "/api/history"],
  ["GET", "/api/drafts"],
  ["GET", "/api/admin"],
  ["GET", "/api/account/avatar"],
  ["GET", `/api/files/${id}`],
  ["GET", `/api/files/${id}/versions`],
  ["GET", `/api/drafts/${id}`],
  ["PATCH", "/api/account"],
  ["POST", "/api/files/upload"],
  ["POST", "/api/favorites"],
];
for (const [i, [method, url]] of guest.entries())
  test(
    `DC-GUEST-${String(i + 1).padStart(3, "0")} ${method} ${url} requires a session`,
    {
      tag: "@security",
      annotation: [
        { type: "Given", description: "an unauthenticated API client" },
        { type: "When", description: `${method} ${url}` },
        { type: "Then", description: "401 and no private data" },
      ],
    },
    async ({ request }) => {
      await test.step("Given no session, When accessing a private API, Then reject access", async () => {
        const r = await request.fetch(url, {
          method,
          headers: { origin: "http://localhost:3000" },
          ...(method === "GET" ? {} : { data: {} }),
        });
        expect(r.status()).toBe(401);
        expect(await r.json()).toHaveProperty("error");
      });
    },
  );
const mutations: [string, string][] = [
  ["POST", "/api/auth/login"],
  ["POST", "/api/auth/register"],
  ["POST", "/api/auth/logout"],
  ["PATCH", "/api/account"],
  ["DELETE", "/api/account"],
  ["PUT", "/api/account/avatar"],
  ["DELETE", "/api/account/avatar"],
  ["POST", "/api/files/upload"],
  ["PATCH", `/api/files/${id}`],
  ["DELETE", `/api/files/${id}`],
  ["POST", "/api/folders"],
  ["POST", "/api/favorites"],
  ["POST", "/api/history"],
  ["POST", "/api/drafts"],
];
let n = 0;
for (const origin of ["missing", "https://untrusted.example"])
  for (const [method, url] of mutations)
    test(
      `DC-CSRF-${String(++n).padStart(3, "0")} ${method} ${url} rejects ${origin} origin`,
      {
        tag: "@security",
        annotation: [
          { type: "Given", description: `a ${origin} origin` },
          { type: "When", description: `${method} ${url}` },
          { type: "Then", description: "403 origin rejection before mutation" },
        ],
      },
      async ({ request }) => {
        await test.step("Given an untrusted request, When mutating state, Then reject the origin", async () => {
          const r = await request.fetch(url, {
            method,
            headers: origin === "missing" ? {} : { origin },
            data: {},
          });
          expect(r.status()).toBe(403);
          expect((await r.json()).error).toContain("origin");
        });
      },
    );
