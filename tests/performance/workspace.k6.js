/* global __ENV */
import http from "k6/http";
import { check, sleep } from "k6";
const base = __ENV.BASE_URL || "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1|host\.docker\.internal):3000$/.test(base))
  throw new Error(
    "This workload is restricted to the local DocuCore test deployment on port 3000.",
  );
const origin = "http://localhost:3000";
const flows = {
  home: "/",
  tools: "/tools",
  privacy: "/privacy",
  help: "/help",
  settings: "/settings",
  health: "/api/health",
  files: "/api/files",
  folders: "/api/folders",
  history: "/api/history",
  download: "dynamic",
};
const scenarios = {},
  thresholds = {};
for (const kind of ["smoke", "load"])
  for (const flow of Object.keys(flows)) {
    const name = `${kind}_${flow}`;
    scenarios[name] = {
      executor: kind === "smoke" ? "shared-iterations" : "constant-vus",
      exec: "requestFlow",
      vus: 1,
      ...(kind === "smoke"
        ? { iterations: 3, maxDuration: "15s" }
        : { duration: "20s", startTime: "3s" }),
      gracefulStop: "5s",
      env: { FLOW: flow },
    };
    thresholds[`http_req_duration{scenario:${name}}`] = ["p(95)<1500"];
    thresholds[`http_req_failed{scenario:${name}}`] = ["rate<0.01"];
    thresholds[`checks{scenario:${name}}`] = ["rate==1"];
  }
export const options = {
  scenarios,
  thresholds,
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  setupTimeout: "30s",
  teardownTimeout: "30s",
};
function headers(cookie) {
  return {
    Origin: origin,
    "Content-Type": "application/json",
    ...(cookie ? { Cookie: `docucore-session=${cookie}` } : {}),
  };
}
export function setup() {
  const password = "k6-synthetic-password-2026",
    email = `k6-${Date.now()}@example.test`;
  const r = http.post(
    `${base}/api/auth/register`,
    JSON.stringify({ email, password, name: "k6 synthetic fixture" }),
    { headers: headers(), timeout: "10s" },
  );
  if (r.status !== 200) throw new Error(`Fixture registration failed (${r.status})`);
  const cookie = r.cookies["docucore-session"]?.[0]?.value;
  if (!cookie) throw new Error("No session cookie from fixture registration");
  try {
    const fixture = "DocuCore local load fixture.\n";
    const upload = http.post(
      `${base}/api/files/upload`,
      { save: "true", file: http.file(fixture, "performance.txt", "text/plain") },
      { headers: { Origin: origin, Cookie: `docucore-session=${cookie}` }, timeout: "10s" },
    );
    if (upload.status !== 201) throw new Error(`Fixture upload failed (${upload.status})`);
    return { cookie, password, fileId: upload.json("file.id"), fixture };
  } catch (error) {
    http.del(`${base}/api/account`, JSON.stringify({ password }), { headers: headers(cookie) });
    throw error;
  }
}
export function requestFlow(data) {
  const flow = __ENV.FLOW,
    path = flow === "download" ? `/api/files/${data.fileId}` : flows[flow];
  const r = http.get(base + path, {
    headers: headers(data.cookie),
    tags: { name: flow },
    timeout: "10s",
  });
  check(r, {
    "HTTP 200": (r) => r.status === 200,
    "expected content": (r) => {
      if (flow === "health") return r.body.includes('"status":"ok"');
      if (flow === "download")
        return r.body === data.fixture && r.headers["Cache-Control"].includes("no-store");
      if (flow === "files") return r.body.includes(data.fileId);
      if (flow === "folders" || flow === "history") return r.body.includes(`"${flow}"`);
      return r.body.includes("DocuCore");
    },
  });
  sleep(0.3);
}
export function teardown(data) {
  const r = http.del(`${base}/api/account`, JSON.stringify({ password: data.password }), {
    headers: headers(data.cookie),
    timeout: "10s",
  });
  if (!check(r, { "fixture account removed": (r) => r.status === 200 }))
    throw new Error("Fixture cleanup failed");
}
export function handleSummary(data) {
  return {
    [__ENV.SUMMARY_PATH || "automation-results/k6.json"]: JSON.stringify(data, null, 2),
    stdout: "k6: 20 scenario summaries written; thresholds determine the process exit status.\n",
  };
}
