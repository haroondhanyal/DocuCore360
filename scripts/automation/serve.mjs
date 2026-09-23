import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("automation-results");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webm": "video/webm",
};
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    let file = resolve(root, "." + pathname);
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    res.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end("Report not found. Run npm run automation:complete first.");
  }
}).listen(4173, "127.0.0.1", () => console.log("Combined reports: http://localhost:4173"));
