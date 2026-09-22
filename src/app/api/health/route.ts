import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { access, constants } from "node:fs/promises";
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    await access(process.env.STORAGE_ROOT ?? "storage", constants.R_OK | constants.W_OK);
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
