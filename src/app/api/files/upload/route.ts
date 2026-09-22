import { z } from "zod";
import { sharedRateLimit } from "@/server/services/shared-rate-limit";
import { NextResponse } from "next/server";
import { requireUser } from "@/server/services/auth";
import { apiError, HttpError, sameOrigin } from "@/server/http";
import { saveFile } from "@/server/services/files";
import { MAX_FILE_BYTES } from "@/lib/validation/files";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    await sharedRateLimit(`upload:${user.id}`, 20);
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.startsWith("multipart/form-data"))
      throw new HttpError(400, "A multipart file upload is required.");
    const max = MAX_FILE_BYTES + 64 * 1024;
    if (Number(request.headers.get("content-length") ?? 0) > max)
      throw new HttpError(413, "Upload is too large.");
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, "Choose a file.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw new HttpError(413, "Upload is too large.");
      }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": contentType },
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Choose a file.");
    if (form.get("save") !== "true") throw new HttpError(400, "Saving requires explicit consent.");
    const replaceId = form.get("replaceId");
    return NextResponse.json(
      { file: await saveFile(user.id, file, replaceId ? z.uuid().parse(replaceId) : undefined) },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
