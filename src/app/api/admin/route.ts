import { mailConfigured } from "@/server/services/mail";
import { sharedRateLimit } from "@/server/services/shared-rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";
import { access, statfs } from "node:fs/promises";
import { constants } from "node:fs";
import { requireAdmin } from "@/server/services/auth";
import { apiError, sameOrigin, jsonBody, HttpError } from "@/server/http";
import { db } from "@/server/db";
import { cleanup } from "@/server/services/cleanup";
export async function GET() {
  try {
    await requireAdmin();
    const [users, files, versions, jobs, history, audits, activeSessions, totalUsers] =
      await Promise.all([
        db.user.findMany({
          take: 200,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            disabled: true,
            createdAt: true,
          },
        }),
        db.fileAsset.aggregate({ _sum: { fileSize: true }, _count: true }),
        db.fileVersion.aggregate({ _sum: { fileSize: true }, _count: true }),
        db.processingJob.findMany({
          take: 50,
          orderBy: { createdAt: "desc" },
          select: { id: true, tool: true, status: true, progress: true, createdAt: true },
        }),
        db.toolHistory.groupBy({
          by: ["tool"],
          _count: true,
          orderBy: { _count: { tool: "desc" } },
          take: 10,
        }),
        db.auditLog.findMany({ take: 50, orderBy: { createdAt: "desc" } }),
        db.accountSession.count({ where: { expiresAt: { gt: new Date() } } }),
        db.user.count(),
      ]);
    let storageWritable = false,
      freeBytes: number | null = null;
    try {
      const root = process.env.STORAGE_ROOT ?? "storage";
      await access(root, constants.R_OK | constants.W_OK);
      storageWritable = true;
      const stat = await statfs(root);
      freeBytes = stat.bavail * stat.bsize;
    } catch {}
    return NextResponse.json(
      {
        users,
        totalUsers,
        stats: {
          files: files._count,
          storageBytes: (files._sum.fileSize ?? 0) + (versions._sum.fileSize ?? 0),
          versions: versions._count,
          activeSessions,
        },
        jobs,
        history,
        audits,
        health: {
          database: true,
          storageWritable,
          freeBytes,
          emailDelivery: mailConfigured(),
          checkedAt: new Date().toISOString(),
          processing: "Browser-reported processing records; no server conversion queue",
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const admin = await requireAdmin();
    await sharedRateLimit(`admin:${admin.id}`, 20);
    const input = z
      .discriminatedUnion("action", [
        z.object({ action: z.literal("cleanup") }),
        z.object({
          action: z.literal("user"),
          id: z.uuid(),
          role: z.enum(["USER", "ADMIN"]).optional(),
          disabled: z.boolean().optional(),
        }),
      ])
      .parse(await jsonBody(req));
    if (input.action === "cleanup") {
      const result = await cleanup();
      await db.auditLog.create({ data: { userId: admin.id, action: "ADMIN_CLEANUP" } });
      return NextResponse.json({ ok: true, result });
    }
    if (input.id === admin.id) throw new HttpError(400, "You cannot change your own access.");
    await db.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({ where: { id: input.id } });
        if (!target) throw new HttpError(404, "User not found.");
        if (
          target.role === "ADMIN" &&
          !target.disabled &&
          (input.role === "USER" || input.disabled)
        ) {
          const count = await tx.user.count({ where: { role: "ADMIN", disabled: false } });
          if (count <= 1)
            throw new HttpError(400, "At least one enabled administrator is required.");
        }
        await tx.user.update({
          where: { id: input.id },
          data: { role: input.role, disabled: input.disabled },
        });
        if (input.disabled || input.role)
          await tx.accountSession.deleteMany({ where: { userId: input.id } });
        await tx.auditLog.create({
          data: { userId: admin.id, action: `ADMIN_USER_ACCESS:${input.id}` },
        });
      },
      { isolationLevel: "Serializable" },
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
