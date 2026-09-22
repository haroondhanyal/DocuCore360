import { db } from "@/server/db";
import { storage } from "@/server/storage/local";
export async function cleanup() {
  const files = await db.fileAsset.findMany({
    where: { isTemporary: true, expiresAt: { lte: new Date() } },
    take: 1000,
  });
  let removed = 0;
  for (const f of files) {
    const versions = await db.fileVersion.findMany({ where: { fileId: f.id } });
    for (const v of versions) await storage.remove(v.storagePath);
    await storage.remove(f.storagePath);
    await db.fileAsset.delete({ where: { id: f.id } });
    removed++;
  }
  const sessions = await db.accountSession.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  const tokens = await db.authToken.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await db.rateLimitBucket.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  return { files: removed, sessions: sessions.count, tokens: tokens.count };
}
