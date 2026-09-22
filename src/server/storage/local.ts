import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
const root = path.resolve(process.env.STORAGE_ROOT ?? "storage");
export interface StorageAdapter {
  put(bytes: Uint8Array, ext: string, temporary?: boolean): Promise<string>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
export function resolveStoragePath(key: string) {
  if (!/^(uploads|processed|temp)\/[a-f0-9-]+\.(pdf|png|jpe?g|webp|docx|xlsx|txt|csv|html|draft)$/.test(key)) throw new Error("Invalid storage key.");
  const file = path.resolve(root, key);
  if (!file.startsWith(root + path.sep)) throw new Error("Unsafe file path.");
  return file;
}
export const storage: StorageAdapter = {
  async put(bytes, ext, temporary = false) {
    const folder = temporary ? "temp" : "uploads";
    const key = `${folder}/${randomUUID()}.${ext}`;
    const file = resolveStoragePath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes, { flag: "wx", mode: 0o600 }); return key;
  },
  get(key) { return readFile(resolveStoragePath(key)); },
  async remove(key) { try { await unlink(resolveStoragePath(key)); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; } }
};
