import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { validateOffice } from "@/lib/advanced/office-validation";
import { db } from "@/server/db";
import { storage } from "@/server/storage/local";
import { validateFile, extension, safeDisplayName, MAX_FILE_BYTES } from "@/lib/validation/files";
import { HttpError } from "@/server/http";
export async function saveFile(userId: string, file: File, replaceId?: string) {
  const previous = replaceId
    ? await db.fileAsset.findFirst({ where: { id: replaceId, userId } })
    : null;
  if (replaceId && !previous) throw new HttpError(404, "Saved file not found.");
  if (previous && previous.extension !== extension(file.name))
    throw new HttpError(400, "New version must have the same file extension.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let mimeType: string;
  let pageCount: number | undefined;
  try {
    mimeType = validateFile(
      file.name,
      file.type,
      file.size,
      bytes,
      Math.min(MAX_FILE_BYTES, Number(process.env.MAX_UPLOAD_MB ?? 25) * 1024 * 1024),
    );
    if (mimeType === "application/pdf") {
      const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
      pageCount = pdf.getPageCount();
      if (pageCount < 1 || pageCount > 500) throw new Error("Saved PDFs must contain 1–500 pages.");
    } else if (["docx", "xlsx"].includes(extension(file.name))) {
      await validateOffice(bytes, extension(file.name) as "docx" | "xlsx");
    } else if (mimeType.startsWith("text/")) {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } else {
      const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error" });
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height) throw new Error("This image is damaged.");
      // Decode to a bounded thumbnail to detect malformed image data without storing a transformed copy.
      await image.resize({ width: 8, height: 8, fit: "inside" }).png().toBuffer();
    }
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "Invalid file.");
  }
  const storagePath = await storage.put(bytes, extension(file.name));
  try {
    return await db.$transaction(async (tx) => {
      if (previous) {
        await tx.$queryRaw`SELECT id FROM "FileAsset" WHERE id=${previous.id}::uuid FOR UPDATE`;
        const current = await tx.fileAsset.findFirst({ where: { id: previous.id, userId } });
        if (!current) throw new HttpError(404, "Saved file not found.");
        if ((await tx.fileVersion.count({ where: { fileId: current.id } })) >= 20)
          throw new HttpError(400, "Limit: 20 versions per file.");
        await tx.fileVersion.create({
          data: {
            fileId: current.id,
            storagePath: current.storagePath,
            fileSize: current.fileSize,
            label: `Before update ${new Date().toISOString()}`,
          },
        });
        await tx.fileAsset.update({
          where: { id: current.id },
          data: { storagePath, fileSize: file.size, pageCount, mimeType },
        });
        await tx.auditLog.create({ data: { userId, action: "FILE_VERSION_UPDATE" } });
        return { id: current.id, displayName: current.displayName };
      }
      const asset = await tx.fileAsset.create({
        data: {
          userId,
          originalName: safeDisplayName(file.name),
          displayName: safeDisplayName(file.name),
          extension: extension(file.name),
          mimeType,
          fileSize: file.size,
          storagePath,
          pageCount,
          isTemporary: false,
        },
      });
      await tx.auditLog.create({ data: { userId, action: "FILE_UPLOAD" } });
      return { id: asset.id, displayName: asset.displayName };
    });
  } catch (error) {
    await storage.remove(storagePath);
    throw error;
  }
}
