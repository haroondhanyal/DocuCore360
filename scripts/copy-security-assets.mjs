import { cp, mkdir, copyFile } from "node:fs/promises";
await mkdir("public/security", { recursive: true });
await cp("node_modules/pdfstudio/dist", "public/security", { recursive: true });
await copyFile("src/workers/security.worker.mjs", "public/security/worker.mjs");
