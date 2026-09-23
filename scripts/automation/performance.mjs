import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
mkdirSync("automation-results", { recursive: true });
const native = process.env.K6_BINARY;
const args = native
  ? ["run", "--quiet", "tests/performance/workspace.k6.js"]
  : [
      "run",
      "--rm",
      "--user",
      `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
      "--add-host=host.docker.internal:host-gateway",
      "-v",
      `${process.cwd()}/tests/performance:/scripts:ro`,
      "-v",
      `${process.cwd()}/automation-results:/results`,
      "-e",
      "BASE_URL=http://host.docker.internal:3000",
      "-e",
      "SUMMARY_PATH=/results/k6.json",
      "grafana/k6:1.6.1",
      "run",
      "--quiet",
      "/scripts/workspace.k6.js",
    ];
const r = spawnSync(native || "docker", args, { stdio: "inherit", env: process.env });
if (r.error) console.error(r.error.message);
process.exit(r.status ?? 1);
