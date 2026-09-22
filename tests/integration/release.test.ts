import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/server/db";
import { storage } from "@/server/storage/local";
import { sharedRateLimit } from "@/server/services/shared-rate-limit";
import { validateParent } from "@/server/services/folders";
import { saveFile } from "@/server/services/files";
import { PDFDocument } from "pdf-lib";
const ids: string[] = [];
afterAll(async () => {
  for (const id of ids) {
    const files = await db.fileAsset.findMany({ where: { userId: id } });
    const versions = await db.fileVersion.findMany({ where: { file: { userId: id } } });
    for (const item of [...files, ...versions]) await storage.remove(item.storagePath);
    await db.user.deleteMany({ where: { id } });
  }
  await db.$disconnect();
});
describe.skipIf(!process.env.DATABASE_URL)("release database boundaries", () => {
  it("limits concurrent requests atomically across callers", async () => {
    const key = `test:${crypto.randomUUID()}`;
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => sharedRateLimit(key, 3, 60000)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
  });
  it("rejects folder cycles and foreign parents", async () => {
    const user = await db.user.create({
      data: {
        name: "Release test",
        email: `release-${crypto.randomUUID()}@example.test`,
        passwordHash: "test-only",
      },
    });
    ids.push(user.id);
    const parent = await db.folder.create({ data: { userId: user.id, name: "Parent" } });
    const child = await db.folder.create({
      data: { userId: user.id, name: "Child", parentId: parent.id },
    });
    await expect(validateParent(user.id, child.id, parent.id)).rejects.toThrow("descendants");
    await expect(validateParent(crypto.randomUUID(), parent.id)).rejects.toThrow("not found");
  });
  it("replacing a saved result preserves previous bytes as a version", async () => {
    const d = await PDFDocument.create();
    d.addPage();
    const first = await d.save();
    const f = await saveFile(
      ids[0],
      new File([new Uint8Array(first)], "version.pdf", { type: "application/pdf" }),
    );
    d.addPage();
    const second = await d.save();
    await saveFile(
      ids[0],
      new File([new Uint8Array(second)], "updated.pdf", { type: "application/pdf" }),
      f.id,
    );
    const asset = await db.fileAsset.findUniqueOrThrow({ where: { id: f.id } });
    expect(asset.pageCount).toBe(2);
    const snapshots = await db.fileVersion.findMany({ where: { fileId: f.id } });
    expect(snapshots).toHaveLength(1);
    expect(
      (await PDFDocument.load(await storage.get(snapshots[0].storagePath))).getPageCount(),
    ).toBe(1);
  });
});
