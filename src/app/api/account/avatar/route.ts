import { NextResponse } from "next/server";
import sharp from "sharp";
import { db } from "@/server/db";
import { requireUser } from "@/server/services/auth";
import { storage } from "@/server/storage/local";
import { apiError, HttpError, sameOrigin } from "@/server/http";
import { sharedRateLimit } from "@/server/services/shared-rate-limit";
export async function GET() {
  try {
    const user = await requireUser();
    const account = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { avatarPath: true },
    });
    if (!account.avatarPath) throw new HttpError(404, "No profile photo.");
    return new NextResponse(new Uint8Array(await storage.get(account.avatarPath)), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
async function replace(userId: string, key: string | null) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
    const account = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    await tx.user.update({
      where: { id: userId },
      data: { avatarPath: key, avatarUpdatedAt: key ? new Date() : null },
    });
    return account.avatarPath;
  });
}
export async function PUT(request: Request) {
  let key: string | undefined;
  try {
    sameOrigin(request);
    const user = await requireUser();
    await sharedRateLimit(`avatar:${user.id}`, 15);
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, "Choose a photo.");
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new HttpError(413, "Profile photos must be under 2 MB.");
      }
      chunks.push(value);
    }
    let bytes: Buffer;
    try {
      const input = sharp(Buffer.concat(chunks), { limitInputPixels: 16_000_000, failOn: "error" });
      const metadata = await input.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1)
        throw new Error("Invalid image");
      bytes = await input
        .rotate()
        .resize(512, 512, { fit: "cover" })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new HttpError(400, "Choose a valid JPG, PNG or WebP photo (up to 16 megapixels).");
    }
    key = await storage.put(bytes, "webp");
    const old = await replace(user.id, key);
    key = undefined;
    if (old) await storage.remove(old);
    return NextResponse.json({ message: "Profile photo updated." });
  } catch (e) {
    if (key) await storage.remove(key);
    return apiError(e);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    const old = await replace(user.id, null);
    if (old) await storage.remove(old);
    return NextResponse.json({ message: "Profile photo removed." });
  } catch (e) {
    return apiError(e);
  }
}
