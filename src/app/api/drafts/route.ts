import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireUser } from "@/server/services/auth";
import { apiError, sameOrigin, jsonBody, HttpError } from "@/server/http";
import { sharedRateLimit } from "@/server/services/shared-rate-limit";
import { parseDraft } from "@/server/services/drafts";
import { storage } from "@/server/storage/local";
export async function GET() {
  try {
    const u = await requireUser();
    return NextResponse.json(
      {
        drafts: await db.editorDraft.findMany({
          where: { userId: u.id },
          orderBy: { updatedAt: "desc" },
          select: { id: true, name: true, revision: true, fileSize: true, updatedAt: true },
        }),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  let key: string | undefined;
  try {
    sameOrigin(req);
    const u = await requireUser();
    await sharedRateLimit(`draft:${u.id}`, 30);
    if ((await db.editorDraft.count({ where: { userId: u.id } })) >= 20)
      throw new HttpError(400, "Limit: 20 account drafts.");
    const draft = await parseDraft(await jsonBody(req, 40 * 1024 * 1024));
    const bytes = Buffer.from(JSON.stringify(draft));
    key = await storage.put(bytes, "draft");
    const result = await db.editorDraft.create({
      data: { userId: u.id, name: draft.name, storagePath: key, fileSize: bytes.length },
      select: { id: true, revision: true },
    });
    key = undefined;
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (key) await storage.remove(key);
    return apiError(e);
  }
}
