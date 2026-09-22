import { NextResponse } from "next/server";
import { ZodError } from "zod";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.APP_URL ?? "http://localhost:3000").origin;
  if (origin !== expected) throw new HttpError(403, "This request origin is not allowed.");
}
const limits = new Map<string, { count: number; expires: number }>();
export function rateLimit(key: string, max = 12, windowMs = 60_000) {
  const now = Date.now();
  if (limits.size > 10_000) for (const [k, v] of limits) if (v.expires <= now) limits.delete(k);
  let item = limits.get(key);
  if (!item || item.expires <= now) {
    item = { count: 0, expires: now + windowMs };
    limits.set(key, item);
  }
  if (++item.count > max)
    throw new HttpError(429, "Too many attempts. Please wait a minute and try again.");
}
export async function jsonBody(request: Request, maxBytes = 16_384) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "A request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "Request is too large.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new HttpError(400, "Invalid JSON request.");
  }
}
export function apiError(error: unknown) {
  if (error instanceof HttpError)
    return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  console.error("API failure", error instanceof Error ? error.name : "Unknown error");
  return NextResponse.json(
    { error: "The service is unavailable. Check the database connection and try again." },
    { status: 503 },
  );
}
