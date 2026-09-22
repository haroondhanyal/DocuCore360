import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, tokenHash } from "@/lib/security/password";
import { validateFile, safeDisplayName, MAX_FILE_BYTES } from "@/lib/validation/files";
import { resolveStoragePath } from "@/server/storage/local";
import { sameOrigin, rateLimit } from "@/server/http";
import { searchTools } from "@/config/tools";
describe("Security boundaries", () => {
  it("salts password hashes and verifies without plaintext storage", async () => {
    const a = await hashPassword("a-long-test-password"),
      b = await hashPassword("a-long-test-password");
    expect(a).not.toBe(b);
    expect(a).not.toContain("test-password");
    expect(await verifyPassword("a-long-test-password", a)).toBe(true);
    expect(await verifyPassword("wrong", a)).toBe(false);
    expect(await verifyPassword("x", "invalid")).toBe(false);
  });
  it("hashes bearer tokens consistently", () => {
    expect(tokenHash("token")).toHaveLength(64);
    expect(tokenHash("token")).toBe(tokenHash("token"));
  });
  it("validates MIME, extension and magic bytes independently", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7");
    expect(validateFile("a.pdf", "application/pdf", 100, pdf)).toBe("application/pdf");
    expect(() => validateFile("a.png", "image/png", 100, pdf)).toThrow();
    expect(() => validateFile("a.pdf", "text/html", 100, pdf)).toThrow();
    expect(() => validateFile("a.html", "text/html", 100, pdf)).toThrow();
    expect(() => validateFile("a.pdf", "application/pdf", MAX_FILE_BYTES + 1, pdf)).toThrow();
    expect(() => validateFile("a.pdf", "application/pdf", 0, pdf)).toThrow();
  });
  it("blocks traversal and unsafe storage keys", () => {
    expect(() => resolveStoragePath("../../.env")).toThrow();
    expect(() => resolveStoragePath("uploads/../secret.pdf")).toThrow();
    expect(() => resolveStoragePath("uploads/abc.js")).toThrow();
    expect(resolveStoragePath("uploads/abc-123.pdf")).toContain("storage/uploads/abc-123.pdf");
    expect(safeDisplayName("../hello\\world\u0000.pdf")).not.toMatch(/[\\/\u0000]/);
  });
  it("rejects cross-origin writes and missing origins", () => {
    expect(() =>
      sameOrigin(
        new Request("http://localhost:3000/api/test", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toThrow();
    expect(() => sameOrigin(new Request("http://localhost:3000/api/test"))).toThrow();
    expect(() =>
      sameOrigin(
        new Request("http://localhost:3000/api/test", {
          headers: { origin: process.env.APP_URL ?? "http://localhost:3000" },
        }),
      ),
    ).not.toThrow();
  });
  it("enforces endpoint attempt limits", () => {
    const key = `unit-${Date.now()}`;
    rateLimit(key, 2);
    rateLimit(key, 2);
    expect(() => rateLimit(key, 2)).toThrow("Too many");
  });
});
describe("Tool discovery", () => {
  it("finds aliases and phrase tokens", () => {
    expect(searchTools("pdf image").map((t) => t.id)).toContain("pdf-to-image");
    expect(searchTools("pdf image").map((t) => t.id)).toContain("images-to-pdf");
    expect(searchTools("word to pdf").map((t) => t.id)).toContain("docx-to-pdf");
  });
});
