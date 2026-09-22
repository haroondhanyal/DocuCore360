import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/services/auth";
import { db } from "@/server/db";
import { apiError } from "@/server/http";
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const q = new URL(req.url).searchParams;
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .parse(q.get("page") ?? 1);
    const folder = q.get("folder");
    const where = {
      userId: user.id,
      isTemporary: false,
      ...(q.get("search")
        ? {
            displayName: { contains: q.get("search")!.slice(0, 180), mode: "insensitive" as const },
          }
        : {}),
      ...(folder && folder !== "all"
        ? { folderId: folder === "unfiled" ? null : z.uuid().parse(folder) }
        : {}),
      ...(q.get("favorite") === "true" ? { favorite: true } : {}),
      ...(q.get("type") === "pdf"
        ? { mimeType: "application/pdf" }
        : q.get("type") === "image"
          ? { mimeType: { startsWith: "image/" } }
          : {}),
    };
    const orderBy =
      q.get("sort") === "name"
        ? { displayName: "asc" as const }
        : q.get("sort") === "size"
          ? { fileSize: "desc" as const }
          : { createdAt: "desc" as const };
    const [files, total, stats] = await db.$transaction([
      db.fileAsset.findMany({
        where,
        orderBy: [orderBy, { id: "asc" }],
        skip: (page - 1) * 50,
        take: 50,
        select: {
          id: true,
          folderId: true,
          favorite: true,
          displayName: true,
          fileSize: true,
          mimeType: true,
          pageCount: true,
          createdAt: true,
        },
      }),
      db.fileAsset.count({ where }),
      db.fileAsset.aggregate({
        where: { userId: user.id, isTemporary: false },
        _sum: { fileSize: true },
        _count: true,
      }),
    ]);
    return NextResponse.json(
      {
        files,
        total,
        page,
        pageSize: 50,
        stats: { files: stats._count, bytes: stats._sum.fileSize ?? 0 },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
