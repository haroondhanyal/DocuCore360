type ZipStream = {
  on(event: "data", cb: (chunk: Uint8Array) => void): ZipStream;
  on(event: "error", cb: (e: Error) => void): ZipStream;
  on(event: "end", cb: () => void): ZipStream;
  pause(): void;
  resume(): void;
};
// Check ZIP directory sizes before any decompression. ZIP64, encryption and macros are rejected.
export function inspectOfficeZip(bytes: Uint8Array, kind: "docx" | "xlsx") {
  if (bytes.length > 25 * 1024 * 1024) throw new Error("Office file exceeds 25 MB.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (
      view.getUint32(i, true) === 0x06054b50 &&
      i + 22 + view.getUint16(i + 20, true) === bytes.length
    ) {
      end = i;
      break;
    }
  if (end < 0) throw new Error("Invalid ZIP directory.");
  const count = view.getUint16(end + 10, true),
    size = view.getUint32(end + 12, true),
    offset = view.getUint32(end + 16, true);
  if (
    view.getUint16(end + 4, true) ||
    view.getUint16(end + 6, true) ||
    count !== view.getUint16(end + 8, true) ||
    count > 2000 ||
    offset + size !== end
  )
    throw new Error("Unsupported or excessive ZIP directory.");
  let pos = offset,
    total = 0;
  const names = new Set<string>();
  const entries: { name: string; size: number }[] = [];
  for (let n = 0; n < count; n++) {
    if (pos + 46 > end || view.getUint32(pos, true) !== 0x02014b50)
      throw new Error("Invalid ZIP entry.");
    const flags = view.getUint16(pos + 8, true),
      method = view.getUint16(pos + 10, true),
      compressed = view.getUint32(pos + 20, true),
      expanded = view.getUint32(pos + 24, true),
      length = view.getUint16(pos + 28, true),
      extra = view.getUint16(pos + 30, true),
      comment = view.getUint16(pos + 32, true),
      local = view.getUint32(pos + 42, true);
    if (pos + 46 + length + extra + comment > end) throw new Error("Invalid ZIP entry length.");
    const name = new TextDecoder().decode(bytes.subarray(pos + 46, pos + 46 + length));
    if (
      flags & 1 ||
      ![0, 8].includes(method) ||
      expanded > 20 * 1024 * 1024 ||
      expanded / Math.max(1, compressed) > 200 ||
      local + 30 > offset ||
      names.has(name) ||
      name.includes("..") ||
      name.startsWith("/") ||
      name.includes("\\") ||
      /vbaProject|embeddings\/|activeX\//i.test(name)
    )
      throw new Error("Unsafe, encrypted, macro-enabled or oversized Office archive.");
    if (
      view.getUint32(local, true) !== 0x04034b50 ||
      view.getUint16(local + 8, true) !== method ||
      view.getUint16(local + 6, true) !== flags
    )
      throw new Error("ZIP local header mismatch.");
    const ln = view.getUint16(local + 26, true),
      le = view.getUint16(local + 28, true);
    if (
      local + 30 + ln + le + compressed > offset ||
      new TextDecoder().decode(bytes.subarray(local + 30, local + 30 + ln)) !== name
    )
      throw new Error("Invalid ZIP local entry.");
    total += expanded;
    if (total > 60 * 1024 * 1024) throw new Error("Expanded Office file exceeds 60 MB.");
    names.add(name);
    entries.push({ name, size: expanded });
    pos += 46 + length + extra + comment;
  }
  if (
    pos !== end ||
    !names.has("[Content_Types].xml") ||
    !names.has(kind === "docx" ? "word/document.xml" : "xl/workbook.xml")
  )
    throw new Error(`This is not a valid ${kind.toUpperCase()} archive.`);
  return entries;
}
export async function validateOffice(bytes: Uint8Array, kind: "docx" | "xlsx") {
  const entries = inspectOfficeZip(bytes, kind);
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: false });
  for (const entry of entries) {
    if (entry.name.endsWith("/")) continue;
    const file = zip.file(entry.name);
    if (!file) throw new Error("ZIP entry missing.");
    let size = 0;
    const chunks: Uint8Array[] = [];
    await new Promise<void>((resolve, reject) => {
      const stream = (
        file as unknown as { internalStream(type: string): ZipStream }
      ).internalStream("uint8array");
      stream
        .on("data", (chunk) => {
          size += chunk.length;
          if (size > entry.size || size > 20 * 1024 * 1024) {
            stream.pause();
            reject(new Error("ZIP expanded size mismatch."));
          } else if (/\.(xml|rels)$/i.test(entry.name)) chunks.push(chunk);
        })
        .on("error", reject)
        .on("end", resolve)
        .resume();
    });
    if (size !== entry.size) throw new Error("ZIP expanded size mismatch.");
    if (chunks.length) {
      const merged = new Uint8Array(size);
      let p = 0;
      for (const b of chunks) {
        merged.set(b, p);
        p += b.length;
      }
      const xml = new TextDecoder().decode(merged);
      if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("XML entities are not allowed.");
    }
  }
  return zip;
}
