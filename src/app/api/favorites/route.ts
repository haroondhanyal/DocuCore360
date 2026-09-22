import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/services/auth";
import { db } from "@/server/db";
import { apiError, sameOrigin, jsonBody } from "@/server/http";
import { tools } from "@/config/tools";
export async function GET() {
  try {
    const u = await requireUser();
    return NextResponse.json({
      favorites: (await db.favoriteTool.findMany({ where: { userId: u.id } })).map((f) => f.toolId),
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const u = await requireUser();
    const { toolId, favorite } = z
      .object({
        toolId: z.string().refine((v) => tools.some((t) => t.id === v)),
        favorite: z.boolean(),
      })
      .parse(await jsonBody(req));
    if (favorite)
      await db.favoriteTool.upsert({
        where: { userId_toolId: { userId: u.id, toolId } },
        create: { userId: u.id, toolId },
        update: {},
      });
    else await db.favoriteTool.deleteMany({ where: { userId: u.id, toolId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
