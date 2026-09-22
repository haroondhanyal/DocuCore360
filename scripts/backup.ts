import "dotenv/config";
import { spawn } from "node:child_process";
import { mkdir, cp, writeFile, readFile, readdir, stat, chmod } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
export async function command(binary: string, args: string[], env: NodeJS.ProcessEnv) {
  await new Promise<void>((resolve, reject) => {
    const p = spawn(binary, args, { env, stdio: ["ignore", "ignore", "pipe"] });
    p.stderr.resume();
    p.on("error", () => reject(new Error(`${binary} could not start.`)));
    p.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${binary} failed; check database access and tool versions.`)),
    );
  });
}
export function databaseEnvironment(url: string) {
  const u = new URL(url);
  return {
    ...process.env,
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.slice(1)),
    ...(u.searchParams.get("sslmode") ? { PGSSLMODE: u.searchParams.get("sslmode")! } : {}),
  };
}
async function hashes(root: string, folder = ""): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const name of await readdir(path.join(root, folder))) {
    const relative = path.join(folder, name),
      p = path.join(root, relative);
    const s = await stat(p);
    if (s.isDirectory()) Object.assign(result, await hashes(root, relative));
    else {
      result[relative] = createHash("sha256")
        .update(await readFile(p))
        .digest("hex");
      await chmod(p, 0o600);
    }
  }
  return result;
}
async function main() {
  if (!process.argv.includes("--quiesced"))
    throw new Error("Stop application and scheduler writes first, then pass --quiesced.");
  const root = path.resolve(process.env.BACKUP_ROOT ?? "backups");
  const target = path.join(root, new Date().toISOString().replaceAll(":", "-"));
  await mkdir(target, { recursive: true, mode: 0o700 });
  await command(
    "pg_dump",
    ["--format=custom", "--no-owner", "--no-acl", "--file", path.join(target, "database.dump")],
    databaseEnvironment(process.env.DATABASE_URL!),
  );
  await cp(path.resolve(process.env.STORAGE_ROOT ?? "storage"), path.join(target, "storage"), {
    recursive: true,
    dereference: false,
    errorOnExist: true,
  });
  const files = await hashes(target);
  await writeFile(
    path.join(target, "manifest.json"),
    JSON.stringify({ version: 1, createdAt: new Date().toISOString(), files }, null, 2),
    { mode: 0o600 },
  );
  console.log(`Backup created: ${target}`);
}
if (path.basename(process.argv[1] ?? "") === "backup.ts")
  main().catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  });
