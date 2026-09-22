import { db } from "@/server/db";
import { HttpError } from "@/server/http";
import type { Prisma } from "@prisma/client";
export async function validateParent(
  userId: string,
  parentId: string | null,
  id?: string,
  client: Prisma.TransactionClient = db,
) {
  let cursor = parentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === id || seen.has(cursor))
      throw new HttpError(400, "A folder cannot be moved into itself or its descendants.");
    if (seen.size >= 20) throw new HttpError(400, "Folder nesting is limited to 20 levels.");
    seen.add(cursor);
    const folder = await client.folder.findFirst({
      where: { id: cursor, userId },
      select: { parentId: true },
    });
    if (!folder) throw new HttpError(404, "Parent folder not found.");
    cursor = folder.parentId;
  }
}
