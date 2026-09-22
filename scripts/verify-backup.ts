import "dotenv/config";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { Client } from "pg";
import { command, databaseEnvironment } from "./backup";
async function main() {
  const root = path.resolve(process.argv[2] ?? "");
  if (!process.argv[2]) throw new Error("Pass a backup directory.");
  const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8")) as {
    files: Record<string, string>;
  };
  for (const [name, digest] of Object.entries(manifest.files)) {
    const file = path.resolve(root, name);
    if (!file.startsWith(root + path.sep)) throw new Error("Invalid manifest path.");
    if (
      createHash("sha256")
        .update(await readFile(file))
        .digest("hex") !== digest
    )
      throw new Error(`Backup checksum mismatch: ${name}`);
  }
  const url = new URL(process.env.DATABASE_URL!);
  const admin = new Client({ connectionString: url.href });
  await admin.connect();
  const name = `docucore_restore_check_${randomBytes(6).toString("hex")}`;
  let created = false;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    url.pathname = "/" + name;
    await command(
      "pg_restore",
      [
        "--no-owner",
        "--no-acl",
        "--exit-on-error",
        "--dbname",
        name,
        path.join(root, "database.dump"),
      ],
      databaseEnvironment(url.href),
    );
    const restored = new Client({ connectionString: url.href });
    await restored.connect();
    try {
      const avatarColumn = await restored.query(
        "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'avatarPath'",
      );
      const files = await restored.query(
        'SELECT "storagePath" FROM "FileAsset" UNION ALL SELECT "storagePath" FROM "FileVersion" UNION ALL SELECT "storagePath" FROM "EditorDraft"' +
          (avatarColumn.rowCount
            ? ' UNION ALL SELECT "avatarPath" AS "storagePath" FROM "User" WHERE "avatarPath" IS NOT NULL'
            : ""),
      );
      for (const file of files.rows) {
        const stored = path.resolve(root, "storage", file.storagePath);
        if (!stored.startsWith(path.join(root, "storage") + path.sep))
          throw new Error("Unsafe restored storage path.");
        await access(stored);
      }
      const users = await restored.query('SELECT count(*)::int AS count FROM "User"');
      console.log(
        JSON.stringify({
          restoreVerified: true,
          users: users.rows[0].count,
          storedObjects: files.rowCount,
          checksums: Object.keys(manifest.files).length,
        }),
      );
    } finally {
      await restored.end();
    }
  } finally {
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Backup verification failed.");
  process.exitCode = 1;
});
