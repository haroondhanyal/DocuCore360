import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireUser } from "@/server/services/auth";
import { apiError, sameOrigin, jsonBody, HttpError } from "@/server/http";
import { sharedRateLimit } from "@/server/services/shared-rate-limit";
import { parseDraft } from "@/server/services/drafts";
import { storage } from "@/server/storage/local";
type Context = { params: Promise<{ id: string }> };
async function owned(ctx: Context) {
  const user = await requireUser();
  const id = z.uuid().parse((await ctx.params).id);
  const draft = await db.editorDraft.findFirst({ where: { id, userId: user.id } });
  if (!draft) throw new HttpError(404, "Draft not found.");
  return { draft, user };
}
export async function GET(_req: Request, ctx: Context) {
  try {
    const { draft } = await owned(ctx);
    return NextResponse.json(
      {
        ...JSON.parse((await storage.get(draft.storagePath)).toString()),
        id: draft.id,
        revision: draft.revision,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function PUT(req: Request, ctx: Context) {
  let key: string | undefined;
  try {
    sameOrigin(req);
    const { draft, user } = await owned(ctx);
    await sharedRateLimit(`draft:${user.id}`, 30);
    const input = await jsonBody(req, 40 * 1024 * 1024);
    const { revision } = z.object({ revision: z.number().int().positive() }).parse(input);
    const parsed = await parseDraft(input);
    const bytes = Buffer.from(JSON.stringify(parsed));
    key = await storage.put(bytes, "draft");
    const updated = await db.editorDraft.updateMany({
      where: { id: draft.id, userId: user.id, revision },
      data: {
        name: parsed.name,
        storagePath: key,
        fileSize: bytes.length,
        revision: { increment: 1 },
      },
    });
    if (!updated.count)
      throw new HttpError(
        409,
        "This draft changed on another device. Restore it or save a new copy.",
      );
    key = undefined;
    await storage.remove(draft.storagePath);
    return NextResponse.json({ id: draft.id, revision: revision + 1 });
  } catch (e) {
    if (key) await storage.remove(key);
    return apiError(e);
  }
}
export async function DELETE(req: Request, ctx: Context) {
  try {
    sameOrigin(req);
    const { draft } = await owned(ctx);
    await storage.remove(draft.storagePath);
    await db.editorDraft.delete({ where: { id: draft.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
