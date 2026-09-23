import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  cpSync,
  mkdirSync,
  copyFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
const root = "automation-results";
const results = `${root}/allure-results`;
const report = `${root}/allure-report`;
const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const write = (p, value) => writeFileSync(p, JSON.stringify(value, null, 2));
const escape = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const summary = read(`${root}/combined.json`);
const owner = process.env.QA_EXECUTOR || "Raja Haroon";
const date = summary.run.startedAt;
const lanes = ["UI", "APIs", "BDD", "Performance", "Unit / Database"];
const walk = (steps) => (steps || []).flatMap((s) => [s, ...walk(s.steps)]);
for (const file of readdirSync(results).filter((f) => f.endsWith("-result.json"))) {
  const r = read(`${results}/${file}`);
  const label = (name) => r.labels?.find((l) => l.name === name)?.value;
  const perf = summary.performance.find((p) => p.title === r.name);
  const unit = label("suite") === "unit/database" || label("parentSuite") === "Unit / Database";
  const bdd = label("framework")?.includes("cucumber") || r.name.includes("DC-BDD-");
  const steps = walk(r.steps);
  const api = !steps.some((s) => /Create page|Fixture "page"/.test(s.name));
  const lane = perf ? "Performance" : unit ? "Unit / Database" : bdd ? "BDD" : api ? "APIs" : "UI";
  const oldSuite = label("subSuite") || label("suite") || lane;
  r.labels = (r.labels || []).filter(
    (l) => !["parentSuite", "suite", "subSuite", "owner", "epic", "feature"].includes(l.name),
  );
  r.labels.push(
    { name: "parentSuite", value: lane },
    {
      name: "suite",
      value: perf
        ? "k6"
        : bdd
          ? "Cucumber BDD"
          : unit
            ? "Vitest"
            : lane === "APIs"
              ? "Playwright API"
              : "Playwright UI",
    },
    { name: "subSuite", value: perf ? r.name.split("_")[0] : oldSuite },
    { name: "owner", value: owner },
    { name: "epic", value: "DocuCore 360" },
    { name: "feature", value: lane },
  );
  r.description = `Project: DocuCore 360\nDepartment: QA Automation\nExecutor: ${owner}\nRun date: ${date}\nLayer: ${lane}\n\n${r.description || ""}`;
  // Category prefixes preserve the original failure detail and never alter execution status.
  r.statusDetails = {
    ...r.statusDetails,
    message: `[${lane}] ${r.statusDetails?.message?.replace(/^\[(UI|APIs|BDD|Performance|Unit \/ Database)\] /, "") || "Execution completed"}`,
  };
  const evidence = `${r.uuid}-qa-evidence.json`;
  write(
    `${results}/${evidence}`,
    perf || {
      name: r.name,
      status: r.status,
      layer: lane,
      steps: steps.map((s) => ({ name: s.name, status: s.status, start: s.start, stop: s.stop })),
      note:
        lane === "APIs"
          ? "API execution steps and assertions; no browser recording applies."
          : "Native framework hooks, screenshots, videos and traces are preserved where produced.",
    },
  );
  r.attachments = [
    ...(r.attachments || []).filter((a) => a.name !== "QA execution evidence"),
    { name: "QA execution evidence", source: evidence, type: "application/json" },
  ];
  if (perf) {
    r.steps = perf.thresholds.map((t) => ({
      name: `k6 threshold: ${t.name}`,
      status: t.passed ? "passed" : "failed",
      stage: "finished",
      steps: [],
      attachments: [],
      parameters: [],
    }));
    r.links = [{ name: "All 20 k6 workloads", url: "../k6/index.html", type: "custom" }];
  }
  write(`${results}/${file}`, r);
}
write(
  `${results}/categories.json`,
  lanes.map((l) => ({
    name: l,
    messageRegex: `^\\[${l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\].*`,
    matchedStatuses: ["passed", "failed", "broken", "skipped", "unknown"],
  })),
);
const ci = process.env.GITHUB_RUN_ID;
const buildUrl = ci
  ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${ci}`
  : "https://github.com/haroondhanyal/DocuCore360";
write(`${results}/executor.json`, {
  name: `${owner} · QA Automation`,
  type: ci ? "github" : "local",
  buildName: `DocuCore 360 · ${date}`,
  buildOrder: Date.parse(date),
  buildUrl,
  reportName: `DocuCore 360 · QA Automation · ${owner}`,
  reportUrl: ci ? buildUrl : "http://localhost:4173/allure-report/index.html",
});
writeFileSync(
  `${results}/environment.properties`,
  `Project=DocuCore 360\nDepartment=QA Automation\nExecutor=${owner}\nDate=${date}\nLayers=UI, APIs, BDD, Performance, Unit / Database\nSource=${summary.run.commit}\nSourceSHA256=${summary.run.sourceSha256}\nTarget=Local production server\n`,
);
if (existsSync(".automation-history/history"))
  cpSync(".automation-history/history", `${results}/history`, { recursive: true });
if (process.env.JAVA_HOME && !existsSync(process.env.JAVA_HOME)) delete process.env.JAVA_HOME;
if (process.platform === "darwin" && !process.env.JAVA_HOME)
  process.env.JAVA_HOME = execFileSync("/usr/libexec/java_home", { encoding: "utf8" }).trim();
execFileSync("npx", ["allure", "generate", results, "--clean", "-o", report], { stdio: "inherit" });
copyFileSync("src/app/icon.svg", `${report}/docucore-logo.svg`);
let html = readFileSync(`${report}/index.html`, "utf8");
html = html
  .replace(
    "</head>",
    `<style>body{padding-top:112px!important}.side-nav{top:112px!important;height:calc(100% - 112px)!important}.qa-brand{position:fixed;top:0;left:0;right:0;height:112px;z-index:9999;background:#123e34;color:white;display:flex;align-items:center;gap:22px;padding:8px 24px;box-sizing:border-box}.qa-brand img{width:88px;height:88px}.qa-brand strong{font-size:24px}.qa-brand a{color:#b6f8de;margin-left:auto}.qa-brand small{display:block}</style></head>`,
  )
  .replace(
    "<body>",
    `<body><header class="qa-brand"><img src="docucore-logo.svg" alt="DocuCore 360 logo"><div><strong>DocuCore 360 · QA Automation</strong><small>${escape(owner)} · ${escape(date)}</small><small>UI · APIs · BDD · Performance</small></div><a href="../k6/index.html">k6 · All 20 workloads →</a></header>`,
  );
writeFileSync(`${report}/index.html`, html);
execFileSync("node", ["scripts/automation/performance-report.mjs"], { stdio: "inherit" });
mkdirSync(".automation-history", { recursive: true });
cpSync(`${report}/history`, ".automation-history/history", { recursive: true });
console.log(
  "Branded Allure, executor, layer suites/categories, native hooks/evidence, history and k6 report ready.",
);
