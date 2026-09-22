import { sharedRateLimit } from "@/server/services/shared-rate-limit";
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
      history: await db.toolHistory.findMany({
        where: { userId: u.id },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const u = await requireUser();
    await sharedRateLimit(`history:${u.id}`, 100);
    const data = z
      .object({
        tool: z.string().refine((v) => tools.some((t) => t.id === v)),
        inputName: z.string().max(180),
        outputName: z.string().max(180).optional(),
        durationMs: z.number().int().min(0).max(86400000),
        success: z.boolean(),
        status: z.enum(["COMPLETED", "FAILED", "CANCELLED"]).optional(),
      })
      .parse(await jsonBody(req));
    const { status, ...record } = data;
    await db.$transaction([
      db.toolHistory.create({ data: { ...record, userId: u.id } }),
      db.processingJob.create({
        data: {
          userId: u.id,
          tool: data.tool,
          status: status ?? (data.success ? "COMPLETED" : "FAILED"),
          progress: data.success ? 100 : 0,
          inputMetadata: { execution: "browser", inputName: data.inputName },
          outputMetadata: { outputName: data.outputName ?? "", durationMs: data.durationMs },
          startedAt: new Date(Date.now() - data.durationMs),
          completedAt: new Date(),
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const u = await requireUser();
    await db.$transaction([
      db.toolHistory.deleteMany({ where: { userId: u.id } }),
      db.processingJob.deleteMany({ where: { userId: u.id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
