import { createHash } from "node:crypto";
import { db } from "@/server/db";
import { HttpError } from "@/server/http";
export async function sharedRateLimit(key: string, max = 12, windowMs = 60000) {
  const hash = createHash("sha256").update(key).digest("hex");
  const rows = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateLimitBucket" ("key","count","expiresAt") VALUES (${hash},1,NOW()+${windowMs}*INTERVAL '1 millisecond') ON CONFLICT ("key") DO UPDATE SET "count"=CASE WHEN "RateLimitBucket"."expiresAt"<=NOW() THEN 1 ELSE "RateLimitBucket"."count"+1 END,"expiresAt"=CASE WHEN "RateLimitBucket"."expiresAt"<=NOW() THEN NOW()+${windowMs}*INTERVAL '1 millisecond' ELSE "RateLimitBucket"."expiresAt" END RETURNING "count"`;
  if (rows[0].count > max)
    throw new HttpError(429, "Too many attempts. Please wait a minute and try again.");
}
