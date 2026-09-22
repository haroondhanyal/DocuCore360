import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/services/auth";
import { fileRepository } from "@/server/repositories/files";
import { apiError, HttpError, sameOrigin, jsonBody } from "@/server/http";
import { storage } from "@/server/storage/local";
import { db } from "@/server/db";
import { safeDisplayName } from "@/lib/validation/files";
type Context = { params: Promise<{ id: string }> };
async function owned(context: Context) {
  const user = await requireUser();
  const id = z.uuid().parse((await context.params).id);
  const file = await fileRepository.find(user.id, id);
  if (!file) throw new HttpError(404, "File not found.");
  return { file, user };
}
export async function GET(_request: Request, context: Context) {
  try {
    const { file } = await owned(context);
    const bytes = await storage.get(file.storagePath);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.displayName)}`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const { file } = await owned(context);
    const data = z
      .object({
        name: z.string().trim().min(1).max(180).optional(),
        folderId: z.uuid().nullable().optional(),
        favorite: z.boolean().optional(),
      })
      .parse(await jsonBody(request));
    if (
      data.folderId &&
      !(await db.folder.findFirst({ where: { id: data.folderId, userId: file.userId! } }))
    )
      throw new HttpError(404, "Folder not found.");
    await db.fileAsset.update({
      where: { id: file.id },
      data: {
        ...(data.name ? { displayName: safeDisplayName(data.name) } : {}),
        ...(data.folderId !== undefined ? { folderId: data.folderId } : {}),
        ...(data.favorite !== undefined ? { favorite: data.favorite } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const { file, user } = await owned(context);
    const versions = await db.fileVersion.findMany({ where: { fileId: file.id } });
    for (const v of versions) await storage.remove(v.storagePath);
    await storage.remove(file.storagePath);
    await db.fileAsset.delete({ where: { id: file.id } });
    await db.auditLog.create({ data: { userId: user.id, action: "FILE_DELETE" } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
