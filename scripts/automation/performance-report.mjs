import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  cpSync,
  readdirSync,
  rmSync,
  copyFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const root = "automation-results",
  out = `${root}/k6`,
  results = `${out}/allure-results`,
  report = `${out}/allure-report`;
const summary = JSON.parse(readFileSync(`${root}/combined.json`, "utf8"));
const raw = JSON.parse(readFileSync(`${root}/k6.json`, "utf8"));
const cases = summary.performance,
  owner = process.env.QA_EXECUTOR || "Raja Haroon",
  date = summary.run.startedAt;
const esc = (x) =>
  String(x ?? "—").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const fmt = (n) => (Number.isFinite(n) ? n.toFixed(1) : "—");
const write = (p, x) => writeFileSync(p, JSON.stringify(x, null, 2));
mkdirSync(out, { recursive: true });
rmSync(results, { recursive: true, force: true });
mkdirSync(results, { recursive: true });
for (const p of cases) {
  const id = createHash("sha256").update(p.id).digest("hex");
  const attachment = `${id}-metrics.json`;
  write(`${results}/${attachment}`, p);
  write(`${results}/${id}-result.json`, {
    uuid: id,
    historyId: id,
    name: `${p.id} · ${p.title}`,
    fullName: `DocuCore/k6/${p.title}`,
    status: p.status === "passed" ? "passed" : "failed",
    stage: "finished",
    start: Date.parse(date),
    stop: Date.parse(date),
    description: `DocuCore 360 · QA Automation\nExecutor: ${owner}\nRun: ${date}\nHTTP latency is shown in the attached metrics. Allure's zero duration is an adapter value, not a measured workload duration.`,
    labels: [
      { name: "parentSuite", value: "k6 Performance" },
      { name: "suite", value: p.title.startsWith("smoke_") ? "Smoke tests" : "Sustained load" },
      { name: "subSuite", value: p.title.replace(/^(smoke|load)_/, "") },
      { name: "owner", value: owner },
    ],
    steps: p.thresholds.map((t) => ({
      name: t.name,
      status: t.passed ? "passed" : "failed",
      stage: "finished",
    })),
    attachments: [
      { name: "Measured k6 metrics and thresholds", type: "application/json", source: attachment },
    ],
  });
}
write(`${results}/executor.json`, {
  name: `${owner} · QA Automation`,
  type: "local",
  buildOrder: Date.parse(date),
  buildName: `DocuCore 360 · ${date}`,
  reportName: "DocuCore 360 · k6 Performance",
  reportUrl: "http://localhost:4173/k6/allure-report/index.html",
});
writeFileSync(
  `${results}/environment.properties`,
  `Project=DocuCore 360\nDepartment=QA Automation\nExecutor=${owner}\nRunDate=${date}\nTool=k6\nScope=10 smoke + 10 sustained-load workloads\nLatencyThreshold=p95 < 1500 ms\nErrorThreshold=< 1 percent\nContentChecks=100 percent\n`,
);
if (existsSync(".automation-history/performance")) {
  cpSync(".automation-history/performance", `${results}/history`, { recursive: true });
  // Regenerating the same measured run must not add duplicate trend samples.
  for (const f of readdirSync(`${results}/history`).filter((f) => f.endsWith("-trend.json"))) {
    const p = `${results}/history/${f}`;
    write(
      p,
      JSON.parse(readFileSync(p)).filter((x) => x.buildOrder !== Date.parse(date)),
    );
  }
  const hp = `${results}/history/history.json`;
  if (existsSync(hp)) {
    const h = JSON.parse(readFileSync(hp));
    for (const v of Object.values(h)) {
      v.items = v.items.filter((i) => i.time?.start !== Date.parse(date));
      v.statistic = { failed: 0, broken: 0, skipped: 0, passed: 0, unknown: 0, total: 0 };
      for (const i of v.items) {
        v.statistic[i.status]++;
        v.statistic.total++;
      }
    }
    write(hp, h);
  }
}
if (process.env.JAVA_HOME && !existsSync(process.env.JAVA_HOME)) delete process.env.JAVA_HOME;
if (process.platform === "darwin" && !process.env.JAVA_HOME)
  process.env.JAVA_HOME = execFileSync("/usr/libexec/java_home", { encoding: "utf8" }).trim();
execFileSync("npx", ["allure", "generate", results, "--clean", "-o", report], { stdio: "inherit" });
copyFileSync("src/app/icon.svg", `${report}/docucore-logo.svg`);
const f = `${report}/index.html`;
writeFileSync(
  f,
  readFileSync(f, "utf8")
    .replace(
      "</head>",
      "<style>body{padding-top:100px!important}.side-nav{top:100px!important;height:calc(100% - 100px)!important}.perf-brand{position:fixed;top:0;left:0;right:0;height:100px;background:#123e34;color:white;z-index:9999;display:flex;align-items:center;gap:20px;padding:12px 24px;box-sizing:border-box}.perf-brand img{width:72px}.perf-brand a{margin-left:auto;color:#b6f8de}</style></head>",
    )
    .replace(
      "<body>",
      `<body><header class="perf-brand"><img src="docucore-logo.svg" alt="DocuCore logo"><div><strong>DocuCore 360 · PERFORMANCE TESTING</strong><br>${esc(owner)} · QA Automation</div><a href="../index.html">Performance dashboard →</a></header>`,
    ),
);
mkdirSync(".automation-history", { recursive: true });
cpSync(`${report}/history`, ".automation-history/performance", { recursive: true });
const max = Math.max(1, ...cases.map((p) => p.p95Ms || 0));
const passed = cases.filter((p) => p.status === "passed").length;
const metric = (name) => raw.metrics?.[name]?.values || {};
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DocuCore 360 · Performance dashboard</title><style>
*{box-sizing:border-box}body{margin:0;background:#f2f6f5;color:#183e34;font:15px system-ui}header{background:#123e34;color:white;padding:30px max(24px,calc((100vw - 1280px)/2));display:flex;align-items:center;gap:22px}header img{width:84px}h1{margin:5px 0;font-size:30px}.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#8de1c2}main{max-width:1328px;padding:28px;margin:auto}.nav{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}a{color:#087451}.button{display:inline-block;background:#126d53;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:650}.secondary{background:white;color:#126d53;border:1px solid #cbded5}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.card,.panel{background:white;border:1px solid #d8e5df;border-radius:14px;padding:22px}.card b{font-size:30px;display:block;margin:8px 0}.muted{color:#60776d;font-size:13px}.panel{margin-top:24px}h2{font-size:20px;margin:0 0 18px}.chart{display:grid;grid-template-columns:1fr 1fr;gap:12px 36px}.bar-row{display:grid;grid-template-columns:115px 1fr 70px;align-items:center;gap:10px;font-size:12px}.track{height:12px;background:#edf3f0;border-radius:8px;overflow:hidden}.bar{height:100%;background:#16886b;border-radius:8px}.load{background:#5882cd}.filters{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px}input,select{font:inherit;padding:10px;border:1px solid #bed3c8;border-radius:7px}table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;padding:14px 10px;border-bottom:1px solid #e1eae6}th{color:#60776d}.scroll{overflow:auto}.badge{display:inline-block;border-radius:20px;background:#e1f4ea;color:#126642;padding:4px 10px}.failed{background:#ffe5e5;color:#a82020}.details{color:#60776d;max-width:280px}.note{line-height:1.7}.legend{display:flex;gap:20px;margin-bottom:16px;color:#60776d}.legend span:before{content:'●';color:#16886b;margin-right:6px}.legend span+span:before{color:#5882cd}@media(max-width:760px){.cards{grid-template-columns:1fr 1fr}.chart{grid-template-columns:1fr}header{padding:22px}header img{width:60px}h1{font-size:22px}main{padding:16px}.bar-row{grid-template-columns:105px 1fr 65px}}@media print{.nav,.filters{display:none}}
</style><header><img src="../logo.svg" alt="DocuCore 360 logo"><div><div class="eyebrow">QA Automation · k6 performance</div><h1>DocuCore 360</h1><div>${esc(owner)} · ${esc(new Date(date).toLocaleString("en-GB", { timeZone: "Asia/Karachi" }))} PKT</div></div></header><main><nav class="nav"><a class="button" href="allure-report/index.html">Open performance Allure →</a><a class="button secondary" href="../allure-report/index.html">Combined Allure</a><a class="button secondary" href="../k6.json">Download raw metrics</a></nav><section class="cards"><div class="card"><span class="muted">WORKLOADS PASSED</span><b>${passed} / ${cases.length}</b><span class="badge ${passed === cases.length ? "" : "failed"}">${passed === cases.length ? "All thresholds passed" : "Review failures"}</span></div><div class="card"><span class="muted">HTTP REQUESTS</span><b>${metric("http_reqs").count ?? "—"}</b><span class="muted">${fmt(metric("http_reqs").rate)} requests / second</span></div><div class="card"><span class="muted">SLOWEST WORKLOAD P95</span><b>${fmt(max)} <small>ms</small></b><span class="muted">Threshold: &lt; 1500 ms per workload</span></div><div class="card"><span class="muted">HTTP ERROR RATE</span><b>${fmt((metric("http_req_failed").rate ?? 0) * 100)}%</b><span class="muted">${fmt((metric("checks").rate ?? 0) * 100)}% content checks passed</span></div></section><section class="panel"><h2>Latency by workload <span class="muted">p95 · milliseconds</span></h2><div class="legend"><span>Smoke</span><span>Sustained load</span></div><div class="chart">${cases.map((p) => `<div class="bar-row"><span>${esc(p.title)}</span><div class="track"><div class="bar ${p.title.startsWith("load_") ? "load" : ""}" style="width:${Math.max(1, ((p.p95Ms || 0) / max) * 100)}%"></div></div><strong>${fmt(p.p95Ms)} ms</strong></div>`).join("")}</div><p class="muted">Bar lengths compare observed p95 values; the pass threshold is 1500 ms.</p></section><section class="panel"><h2>Workload results</h2><div class="filters"><input id="search" type="search" aria-label="Search workloads" placeholder="Search workload or case ID"><select id="lane" aria-label="Workload profile"><option value="">All profiles</option><option value="smoke">Smoke</option><option value="load">Sustained load</option></select><span id="count" aria-live="polite"></span></div><div class="scroll"><table><thead><tr><th>Case / workload</th><th>Status</th><th>Average</th><th>P95</th><th>P99</th><th>Errors</th><th>Threshold evidence</th></tr></thead><tbody>${cases.map((p) => `<tr data-lane="${p.title.split("_")[0]}"><td><strong>${esc(p.title)}</strong><br><span class="muted">${p.id}</span></td><td><span class="badge ${p.status === "passed" ? "" : "failed"}">${esc(p.status)}</span></td><td>${fmt(p.avgMs)} ms</td><td>${fmt(p.p95Ms)} ms</td><td>${fmt(p.p99Ms)} ms</td><td>${fmt(p.errorRate * 100)}%</td><td><details><summary>View ${p.thresholds.length} checks</summary><div class="details">${p.thresholds.map((t) => `${t.passed ? "✓" : "✗"} ${esc(t.name)}`).join("<br>")}</div></details></td></tr>`).join("")}</tbody></table></div></section><section class="panel note"><h2>Run profile</h2>10 smoke flows × 3 iterations; 10 sustained-load flows × 1 VU for 20 seconds. HTTP errors must stay below 1%; all content checks must pass. These are local measurements, not a production capacity benchmark. Browser document conversion is covered by functional tests.<p class="muted">Charts use recorded k6 summaries. No synthetic time-series, screenshots or browser videos are presented as load-test evidence. Performance Allure provides workload suites, threshold steps and measured JSON attachments.</p></section></main><script>const rows=[...document.querySelectorAll('tbody tr')];function filter(){let count=0;for(const row of rows){row.hidden=!(row.textContent.toLowerCase().includes(document.querySelector('#search').value.toLowerCase())&&(!document.querySelector('#lane').value||row.dataset.lane===document.querySelector('#lane').value));if(!row.hidden)count++;}document.querySelector('#count').textContent=count+' workloads';}document.querySelector('#search').addEventListener('input',filter);document.querySelector('#lane').addEventListener('change',filter);filter();</script></html>`;
writeFileSync(`${out}/index.html`, html);
console.log(
  "Performance dashboard and dedicated 20-case Allure report generated from existing measured results.",
);
