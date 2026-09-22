import { PDFDocument } from "pdf-lib";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { storage } from "@/server/storage/local";
import { requireUser } from "@/server/services/auth";
import { apiError, HttpError, sameOrigin, jsonBody } from "@/server/http";
type Context = { params: Promise<{ id: string }> };
async function owned(ctx: Context) {
  const user = await requireUser();
  const id = z.uuid().parse((await ctx.params).id);
  const file = await db.fileAsset.findFirst({ where: { id, userId: user.id } });
  if (!file) throw new HttpError(404, "File not found.");
  return { file, user };
}
export async function GET(req: Request, ctx: Context) {
  try {
    const { file } = await owned(ctx);
    const version = new URL(req.url).searchParams.get("download");
    if (version) {
      const v = await db.fileVersion.findFirst({
        where: { id: z.uuid().parse(version), fileId: file.id },
      });
      if (!v) throw new HttpError(404, "Version not found.");
      return new NextResponse(new Uint8Array(await storage.get(v.storagePath)), {
        headers: {
          "Content-Type": file.mimeType,
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.displayName)}`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    return NextResponse.json({
      versions: await db.fileVersion.findMany({
        where: { fileId: file.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, label: true, fileSize: true, createdAt: true },
      }),
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request, ctx: Context) {
  let key: string | undefined;
  try {
    sameOrigin(req);
    const { file, user } = await owned(ctx);
    const { label } = z
      .object({ label: z.string().trim().min(1).max(80) })
      .parse(await jsonBody(req));
    if ((await db.fileVersion.count({ where: { fileId: file.id } })) >= 20)
      throw new HttpError(400, "Limit: 20 versions per file.");
    key = await storage.put(new Uint8Array(await storage.get(file.storagePath)), file.extension);
    const v = await db.fileVersion.create({
      data: { fileId: file.id, storagePath: key, fileSize: file.fileSize, label },
    });
    key = undefined;
    await db.auditLog.create({ data: { userId: user.id, action: "FILE_VERSION_CREATE" } });
    return NextResponse.json({ version: v.id });
  } catch (e) {
    if (key) await storage.remove(key);
    return apiError(e);
  }
}
export async function PATCH(req: Request, ctx: Context) {
  try {
    sameOrigin(req);
    const { file, user } = await owned(ctx);
    const { id } = z.object({ id: z.uuid() }).parse(await jsonBody(req));
    const version = await db.fileVersion.findFirst({ where: { id, fileId: file.id } });
    if (!version) throw new HttpError(404, "Version not found.");
    const restoredBytes = new Uint8Array(await storage.get(version.storagePath));
    const pageCount =
      file.mimeType === "application/pdf"
        ? (await PDFDocument.load(restoredBytes)).getPageCount()
        : file.pageCount;
    const key = await storage.put(restoredBytes, file.extension);
    try {
      const updated = await db.fileAsset.updateMany({
        where: { id: file.id, userId: user.id, storagePath: file.storagePath },
        data: { storagePath: key, fileSize: version.fileSize, pageCount },
      });
      if (!updated.count)
        throw new HttpError(409, "This file changed. Reload before restoring a version.");
    } catch (e) {
      await storage.remove(key);
      throw e;
    }
    await storage.remove(file.storagePath);
    await db.auditLog.create({ data: { userId: user.id, action: "FILE_VERSION_RESTORE" } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
