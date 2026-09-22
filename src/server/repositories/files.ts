import { db } from "@/server/db";
export const fileRepository = {
  list(userId: string) {
    return db.fileAsset.findMany({
      where: { userId, isTemporary: false },
      orderBy: { createdAt: "desc" },
      take: 1000,
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
    });
  },
  find(userId: string, id: string) {
    return db.fileAsset.findFirst({ where: { id, userId } });
  },
};
