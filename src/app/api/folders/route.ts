import { validateParent } from "@/server/services/folders";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/services/auth";
import { db } from "@/server/db";
import { apiError, sameOrigin, jsonBody, HttpError } from "@/server/http";
export async function GET() {
  try {
    const u = await requireUser();
    return NextResponse.json({
      folders: await db.folder.findMany({ where: { userId: u.id }, orderBy: { name: "asc" } }),
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const u = await requireUser();
    const { name, parentId } = z
      .object({
        name: z.string().trim().min(1).max(80),
        parentId: z.uuid().nullable().default(null),
      })
      .parse(await jsonBody(req));
    const folder = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${u.id}::uuid FOR UPDATE`;
      await validateParent(u.id, parentId, undefined, tx);
      if ((await tx.folder.count({ where: { userId: u.id } })) >= 100)
        throw new HttpError(400, "Limit: 100 folders.");
      if (await tx.folder.findUnique({ where: { userId_name: { userId: u.id, name } } }))
        throw new HttpError(409, "A folder with this name exists.");
      return tx.folder.create({ data: { userId: u.id, name, parentId } });
    });
    return NextResponse.json(folder);
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    const u = await requireUser();
    const { id, name, parentId } = z
      .object({
        id: z.uuid(),
        name: z.string().trim().min(1).max(80).optional(),
        parentId: z.uuid().nullable().optional(),
      })
      .parse(await jsonBody(req));
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${u.id}::uuid FOR UPDATE`;
      if (!(await tx.folder.findFirst({ where: { id, userId: u.id } })))
        throw new HttpError(404, "Folder not found.");
      if (parentId !== undefined) await validateParent(u.id, parentId, id, tx);
      if (name && (await tx.folder.findFirst({ where: { userId: u.id, name, NOT: { id } } })))
        throw new HttpError(409, "A folder with this name exists.");
      await tx.folder.update({ where: { id }, data: { name, parentId } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const u = await requireUser();
    const { id } = z.object({ id: z.uuid() }).parse(await jsonBody(req));
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${u.id}::uuid FOR UPDATE`;
      await tx.folder.deleteMany({ where: { id, userId: u.id } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
