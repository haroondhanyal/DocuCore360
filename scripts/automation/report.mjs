import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
const root = "automation-results";
mkdirSync(root, { recursive: true });
mkdirSync(`${root}/allure-results`, { recursive: true });
const read = (name) => {
  try {
    return JSON.parse(readFileSync(`${root}/${name}`, "utf8"));
  } catch {
    return null;
  }
};
const pw = read("functional.json"),
  bdd = read("cucumber.json"),
  unit = read("unit.json"),
  perf = read("k6.json"),
  run = read("run.json");
const cucumber = (bdd ?? []).flatMap((f) =>
  (f.elements ?? [])
    .filter((e) => e.type === "scenario")
    .map((e) => ({
      id: e.name.match(/DC-BDD-\d+/)?.[0],
      title: e.name,
      category: "cucumber",
      status: e.steps.some((s) => s.result?.status === "failed")
        ? "failed"
        : e.steps.every((s) => s.result?.status === "passed")
          ? "passed"
          : "skipped",
      durationMs: e.steps.reduce((a, s) => a + (s.result?.duration ?? 0) / 1e6, 0),
      steps: e.steps.map((s) => ({ title: s.keyword + s.name, status: s.result?.status })),
      error: e.steps.find((s) => s.result?.error_message)?.result.error_message?.slice(0, 2000),
    })),
);
const cases = [...(pw?.tests ?? []), ...cucumber];
const flows = [
  "home",
  "tools",
  "privacy",
  "help",
  "settings",
  "health",
  "files",
  "folders",
  "history",
  "download",
];
const performance = [];
for (const lane of ["smoke", "load"])
  for (const flow of flows) {
    const key = `${lane}_${flow}`,
      metrics = perf?.metrics ?? {};
    const duration = metrics[`http_req_duration{scenario:${key}}`],
      errors = metrics[`http_req_failed{scenario:${key}}`],
      checks = metrics[`checks{scenario:${key}}`];
    const thresholds = [duration, errors, checks].flatMap((m) =>
      Object.entries(m?.thresholds ?? {}).map(([name, value]) => ({ name, passed: value.ok })),
    );
    performance.push({
      id: `DC-PERF-${String(performance.length + 1).padStart(3, "0")}`,
      title: key,
      status:
        !duration || thresholds.length !== 3
          ? "missing"
          : thresholds.every((t) => t.passed)
            ? "passed"
            : "failed",
      p95Ms: duration?.values?.["p(95)"],
      p99Ms: duration?.values?.["p(99)"],
      avgMs: duration?.values?.avg,
      errorRate: errors?.values?.rate,
      checkRate: checks?.values?.rate,
      thresholds,
    });
  }
const units = (unit?.testResults ?? []).flatMap((f) =>
  (f.assertionResults ?? []).map((t) => ({
    title: t.fullName ?? t.title,
    status: t.status,
    durationMs: t.duration ?? 0,
    category: "unit/database",
  })),
);
const count = (xs, status) => xs.filter((x) => x.status === status).length;
const complete =
  cases.length === 400 &&
  new Set(cases.map((c) => c.id)).size === 400 &&
  count(cases, "passed") === 400 &&
  count(performance, "passed") === 20 &&
  units.length === 55 &&
  count(units, "passed") === 55 &&
  run?.stages?.every((s) => s.exitCode === 0);
const summary = {
  product: "DocuCore 360",
  generatedAt: new Date().toISOString(),
  run,
  status: complete ? "passed" : "incomplete-or-failed",
  counts: {
    functional: {
      expected: 400,
      executed: cases.length,
      passed: count(cases, "passed"),
      failed: cases.filter((c) => ["failed", "timedOut", "interrupted"].includes(c.status)).length,
      timedOut: count(cases, "timedOut"),
      skipped: count(cases, "skipped"),
    },
    playwright: pw?.expected ?? 0,
    cucumber: cucumber.length,
    performance: { expected: 20, passed: count(performance, "passed") },
    unit: { expected: 55, passed: count(units, "passed") },
  },
  cases,
  performance,
  units,
};
writeFileSync(`${root}/combined.json`, JSON.stringify(summary, null, 2));
for (const c of [...performance, ...units]) {
  const suite = c.category ?? "k6 performance";
  writeFileSync(
    `${root}/allure-results/external-${createHash("sha256")
      .update(suite + c.title)
      .digest("hex")}-result.json`,
    JSON.stringify({
      uuid: createHash("sha256")
        .update(suite + c.title)
        .digest("hex"),
      historyId: createHash("sha256")
        .update(suite + c.title)
        .digest("hex"),
      name: c.title,
      fullName: `${suite}/${c.title}`,
      status: c.status === "passed" ? "passed" : c.status === "missing" ? "skipped" : "failed",
      stage: "finished",
      start: Date.parse(run?.startedAt ?? new Date().toISOString()),
      stop: Date.parse(run?.startedAt ?? new Date().toISOString()) + (c.durationMs ?? 0),
      labels: [
        { name: "parentSuite", value: "DocuCore 360" },
        { name: "suite", value: suite },
      ],
      description: JSON.stringify(c, null, 2),
    }),
  );
}
writeFileSync(
  `${root}/allure-results/environment.properties`,
  `Product=DocuCore 360\nTarget=Local production server\nBrowser=Chromium\nFunctional=400 (352 Playwright + 48 Cucumber)\nk6=20 workloads; 10 peak VUs\nCommit=${run?.commit ?? "unrecorded"}\n`,
);
const escape = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const pct = (v) => (v == null ? "—" : `${(v * 100).toFixed(2)}%`);
const ms = (v) => (v == null ? "—" : `${v.toFixed(1)} ms`);
const row = (c) =>
  `<tr data-category="${escape(c.category)}" data-status="${escape(c.status)}"><td>${escape(c.id)}</td><td>${escape(c.title)}${c.error ? `<details><summary>Failure details</summary><pre>${escape(c.error)}</pre></details>` : ""}${c.steps?.length ? `<details><summary>Steps</summary><ul>${c.steps.map((s) => `<li>${escape(s.title)}</li>`).join("")}</ul></details>` : ""}</td><td>${escape(c.category)}</td><td class="${escape(c.status)}">${escape(c.status)}</td><td>${ms(c.durationMs)}</td></tr>`;
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DocuCore 360 · Complete Automation Report</title><style>body{font:15px system-ui;margin:0;background:#f3f7f6;color:#17342e}header{background:#123e34;color:white;padding:32px;display:flex;align-items:center;gap:20px}header img{width:64px}main{max-width:1400px;margin:auto;padding:28px}h1{margin:0}h2{margin-top:32px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:16px}.card{background:white;border:1px solid #d4e1dc;padding:24px;border-radius:12px}.card b{font-size:30px;display:block}table{border-collapse:collapse;width:100%;background:white;font-size:13px}th,td{border-bottom:1px solid #d4e1dc;padding:12px;text-align:left;vertical-align:top}th{background:#dfeee8}pre{white-space:pre-wrap;max-width:750px}.passed{color:#067348}.failed,.timedOut,.missing{color:#aa2424}a{color:#126e59}input,select{padding:12px;border:1px solid #90aaa1;border-radius:6px;margin:6px}details{margin:8px 0}small{display:block}.scroll{overflow:auto}</style><header><img src="logo.svg" alt="DocuCore logo"><div><h1>DocuCore 360</h1><p>UI · API · Cucumber BDD · k6 Performance</p></div></header><main><p><strong>Run status: ${escape(summary.status)}</strong> · ${escape(summary.generatedAt)}<br>Source: ${escape(run?.commit)} · ${run?.dirty ? "working tree changes included" : "clean tree"} · ${escape(run?.platform)}<br>Local verification, not production capacity certification. Matrix variants are listed explicitly; unit and k6 counts are separate.</p><div class="cards"><div class="card"><b>${count(cases, "passed")} / 400</b>Functional scenarios<small>352 Playwright/API + 48 Cucumber</small></div><div class="card"><b>${count(performance, "passed")} / 20</b>k6 workloads<small>10 smoke + 10 sustained-load flows</small></div><div class="card"><b>${count(units, "passed")} / 55</b>Unit/database tests</div><div class="card"><b>${cases.filter((c) => c.status !== "passed").length}</b>Non-passing functional results</div></div><p><a href="allure-report/index.html">Combined Allure report & evidence</a> · <a href="playwright-html/index.html">Playwright HTML</a> · <a href="combined.json">Machine-readable results</a></p><h2>Execution stages</h2><table><tr><th>Stage</th><th>Exit</th><th>Duration</th></tr>${(run?.stages ?? []).map((s) => `<tr><td>${escape(s.name)}</td><td>${s.exitCode}</td><td>${ms(s.durationMs)}</td></tr>`).join("")}</table><h2>k6 performance</h2><p>Each workload requires p95 &lt; 1500 ms, HTTP error rate &lt; 1%, and all content checks passing. Smoke: 3 iterations per flow. Sustained load: 1 VU per flow for 20 seconds; 10 VUs peak. Browser document conversion is measured by functional output checks, not k6 HTTP timings.</p><div class="scroll"><table><tr><th>Workload</th><th>Status</th><th>Average</th><th>P95</th><th>P99</th><th>Error rate</th><th>Checks</th></tr>${performance.map((p) => `<tr><td>${p.title}</td><td class="${p.status}">${p.status}</td><td>${ms(p.avgMs)}</td><td>${ms(p.p95Ms)}</td><td>${ms(p.p99Ms)}</td><td>${pct(p.errorRate)}</td><td>${pct(p.checkRate)}</td></tr>`).join("")}</table></div><h2>Functional scenario results</h2><label>Search <input id="q" type="search" placeholder="ID, scenario or category"></label><label>Status <select id="status"><option value="">All</option><option>passed</option><option>failed</option><option>timedOut</option><option>skipped</option></select></label><span id="shown"></span><div class="scroll"><table id="cases"><thead><tr><th>ID</th><th>Scenario / BDD steps</th><th>Category</th><th>Status</th><th>Duration</th></tr></thead><tbody>${cases.map(row).join("")}</tbody></table></div><h2>Evidence and scope</h2><p>Playwright records screenshots, video and traces for browser cases. Cucumber attaches a screenshot, video and trace for each scenario. Raw evidence can contain synthetic session tokens and is kept in ignored local results / CI artifacts, not published in Git. The shareable report snapshot contains sanitized scenario outcomes and metrics.</p></main><script>const rows=[...document.querySelectorAll('#cases tbody tr')];function filter(){let n=0;for(const row of rows){const show=row.textContent.toLowerCase().includes(document.querySelector('#q').value.toLowerCase())&&(!document.querySelector('#status').value||row.dataset.status===document.querySelector('#status').value);row.hidden=!show;if(show)n++;}document.querySelector('#shown').textContent=n+' scenarios';}document.querySelector('#q').addEventListener('input',filter);document.querySelector('#status').addEventListener('change',filter);filter();</script></html>`;
writeFileSync(`${root}/index.html`, html);
copyFileSync("src/app/icon.svg", `${root}/logo.svg`);
console.log(`Combined report: ${root}/index.html (${summary.status})`);
if (process.argv.includes("--publish") && complete) {
  mkdirSync("docs/automation/latest", { recursive: true });
  const safe = {
    ...summary,
    cases: cases.map((c) =>
      Object.fromEntries(Object.entries(c).filter(([key]) => key !== "attachments")),
    ),
  };
  writeFileSync("docs/automation/latest/results.json", JSON.stringify(safe, null, 2));
  writeFileSync(
    "docs/automation/latest/index.html",
    html.replace(
      '<a href="allure-report/index.html">Combined Allure report & evidence</a> · <a href="playwright-html/index.html">Playwright HTML</a> · <a href="combined.json">Machine-readable results</a>',
      'Full evidence reports are generated locally or downloaded from CI artifacts. · <a href="results.json">Sanitized results</a>',
    ),
  );
  copyFileSync("src/app/icon.svg", "docs/automation/latest/logo.svg");
}
