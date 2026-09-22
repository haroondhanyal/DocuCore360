import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { db } from "@/server/db";
import { saveFile } from "@/server/services/files";
import { storage } from "@/server/storage/local";
import { fileRepository } from "@/server/repositories/files";
import { hashPassword, tokenHash } from "@/lib/security/password";
const ids: string[] = [];
describe.skipIf(!process.env.DATABASE_URL)("PostgreSQL and private file storage", () => {
  afterAll(async () => {
    for (const userId of ids) {
      const files = await db.fileAsset.findMany({ where: { userId } });
      for (const file of files) await storage.remove(file.storagePath);
      await db.user.deleteMany({ where: { id: userId } });
    }
    await db.$disconnect();
  });
  it("persists accounts, private assets and session hashes", async () => {
    const user = await db.user.create({
      data: {
        name: "Integration fixture",
        email: `integration-${crypto.randomUUID()}@example.test`,
        passwordHash: await hashPassword("integration-test-password"),
      },
    });
    ids.push(user.id);
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = new Uint8Array(await pdf.save());
    const file = new File([bytes], "../test.pdf", { type: "application/pdf" });
    const asset = await saveFile(user.id, file);
    const found = await fileRepository.find(user.id, asset.id);
    expect(found?.isTemporary).toBe(false);
    expect(found?.pageCount).toBe(1);
    expect(found?.displayName).not.toContain("/");
    expect(found?.expiresAt).toBeNull();
    expect(await storage.get(found!.storagePath)).toEqual(Buffer.from(bytes));
    expect(await fileRepository.find(crypto.randomUUID(), asset.id)).toBeNull();
    const session = await db.accountSession.create({
      data: {
        userId: user.id,
        tokenHash: tokenHash("integration-bearer-token"),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    expect(session.tokenHash).not.toContain("bearer");
    await storage.remove(found!.storagePath);
    await db.fileAsset.delete({ where: { id: asset.id } });
    await expect(storage.get(found!.storagePath)).rejects.toThrow();
  });
  it("rejects corrupted PDFs before persisting them", async () => {
    const fake = new File(["%PDF-1.7 broken document"], "bad.pdf", { type: "application/pdf" });
    await expect(saveFile(ids[0], fake)).rejects.toThrow();
    expect(await db.fileAsset.count({ where: { userId: ids[0] } })).toBe(0);
  });
});
