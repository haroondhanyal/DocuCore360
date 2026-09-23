import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import { createHash } from "node:crypto";
if (process.env.JAVA_HOME && !existsSync(process.env.JAVA_HOME)) delete process.env.JAVA_HOME;
if (process.platform === "darwin" && !process.env.JAVA_HOME) {
  try {
    process.env.JAVA_HOME = execFileSync("/usr/libexec/java_home", { encoding: "utf8" }).trim();
  } catch {
    /* Allure will report a missing Java runtime. */
  }
}
let awake;
if (process.platform === "darwin") {
  awake = spawn("caffeinate", ["-i", "-w", String(process.pid)], { stdio: "ignore" });
  awake.on("error", () => {});
}
const dir = "automation-results";
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const git = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const sourceFiles = git(["ls-files", "--cached", "--others", "--exclude-standard"])
  .split("\n")
  .filter((f) =>
    /^(src\/|tests\/|scripts\/|\.github\/|package|playwright|cucumber|eslint|tsconfig)/.test(f),
  );
const digest = createHash("sha256");
for (const file of [...new Set(sourceFiles)].sort())
  if (existsSync(file)) digest.update(file).update(readFileSync(file));
const run = {
  sourceSha256: digest.digest("hex"),
  startedAt: new Date().toISOString(),
  commit: git(["rev-parse", "HEAD"]),
  dirty: Boolean(git(["status", "--porcelain"])),
  platform: `${os.platform()} ${os.arch()} / Node ${process.version}`,
  stages: [],
};
const save = () => writeFileSync(`${dir}/run.json`, JSON.stringify(run, null, 2));
save();
let server;
const health = async () => {
  try {
    return (await fetch("http://localhost:3000/api/health", { signal: AbortSignal.timeout(3000) }))
      .ok;
  } catch {
    return false;
  }
};
async function stage(name, cmd, args) {
  const start = Date.now();
  console.log(`\n[Automation] ${name}`);
  const code = await new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: "inherit", env: { ...process.env, LOCAL_MAIL_TEST: "1" } });
    p.on("error", (e) => {
      console.error(e.message);
      resolve(1);
    });
    p.on("exit", (c) => resolve(c ?? 1));
  });
  run.stages.push({ name, exitCode: code, durationMs: Date.now() - start });
  save();
  return code;
}
try {
  if (!(await health())) {
    if (await stage("production build", "npm", ["run", "build"]))
      throw Error("Production build failed");
    server = spawn("npm", ["start", "--", "--hostname", "0.0.0.0"], {
      stdio: "inherit",
      detached: process.platform !== "win32",
    });
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (await health()) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!ready) throw Error("App health never became ready");
  }
  const mail = await fetch("http://localhost:8025/api/v1/info", {
    signal: AbortSignal.timeout(5000),
  });
  if (!mail.ok)
    throw Error("Mailpit on port 8025 is required for complete local email verification");
  if (await stage("inventory", "node", ["scripts/automation/inventory.mjs"]))
    throw Error("Inventory guard failed");
  await stage("lint", "npm", ["run", "lint"]);
  await stage("typecheck", "npm", ["run", "typecheck"]);
  await stage("unit/database", "npx", [
    "vitest",
    "run",
    "--reporter=json",
    `--outputFile=${dir}/unit.json`,
  ]);
  await stage("playwright", "npx", ["playwright", "test", "-c", "playwright.automation.config.ts"]);
  await stage("cucumber", "npx", ["cucumber-js"]);
  await stage("k6", "node", ["scripts/automation/performance.mjs"]);
  await stage("combined report", "node", ["scripts/automation/report.mjs"]);
  await stage("allure report", "npx", [
    "allure",
    "generate",
    `${dir}/allure-results`,
    "--clean",
    "-o",
    `${dir}/allure-report`,
  ]);
  await stage("report snapshot", "node", ["scripts/automation/report.mjs", "--publish"]);
  // Include the snapshot stage itself in final run metadata.
  execFileSync("node", ["scripts/automation/report.mjs", "--publish"], { stdio: "inherit" });
  const summary = JSON.parse(readFileSync(`${dir}/combined.json`, "utf8"));
  process.exitCode = summary.status === "passed" ? 0 : 1;
} catch (error) {
  console.error(error.message);
  run.stages.push({ name: "preflight/runtime", exitCode: 1, error: error.message });
  save();
  try {
    execFileSync("node", ["scripts/automation/report.mjs"], { stdio: "inherit" });
  } catch {}
  process.exitCode = 1;
} finally {
  awake?.kill();
  if (server?.pid) {
    try {
      process.kill(process.platform === "win32" ? server.pid : -server.pid, "SIGTERM");
    } catch {}
  }
}
