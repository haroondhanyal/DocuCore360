export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 20;
export const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
export const ACCEPTED_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  csv: "text/csv",
  html: "text/html",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
export function extension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}
export function signatureType(bytes: Uint8Array): string | null {
  const head = Array.from(bytes.subarray(0, 12));
  const ascii = (start: number, end: number) => String.fromCharCode(...head.slice(start, end));
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}
export function validateFile(
  name: string,
  mime: string,
  size: number,
  bytes: Uint8Array,
  max = MAX_FILE_BYTES,
) {
  const expected = ACCEPTED_TYPES[extension(name)];
  if (!expected) throw new Error("Choose a PDF, JPG, PNG or WebP file.");
  if (size <= 0) throw new Error("This file is empty.");
  if (size > max)
    throw new Error(`Each file must be smaller than ${Math.floor(max / 1024 / 1024)} MB.`);
  if (mime && mime !== expected && mime !== "application/octet-stream")
    throw new Error("The file type does not match its extension.");
  const ext = extension(name);
  const office = ext === "docx" || ext === "xlsx";
  const plain = ["txt", "csv", "html"].includes(ext);
  if (plain && signatureType(bytes))
    throw new Error("Binary file signature does not match this text extension.");
  if (plain && bytes.includes(0)) throw new Error("Text files cannot contain null bytes.");
  if (
    office
      ? !(bytes[0] === 80 && bytes[1] === 75 && bytes[2] === 3 && bytes[3] === 4)
      : !plain && signatureType(bytes) !== expected
  )
    throw new Error("The file signature does not match its extension. It may be damaged.");
  return expected;
}
export function safeDisplayName(name: string) {
  return name.replace(/[\\/\x00-\x1f\x7f]/g, "_").slice(0, 180) || "document";
}
