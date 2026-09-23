import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
} from "@playwright/test/reporter";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
export default class SummaryReporter implements Reporter {
  private rows: Record<string, unknown>[] = [];
  private inventory: Record<string, unknown>[] = [];
  private ids = new Map<string, string>();
  onBegin(_config: FullConfig, suite: Suite) {
    let legacy = 0;
    this.inventory = suite.allTests().map((t) => {
      const id =
        t.title.match(/^DC-[A-Z0-9-]+-\d+/)?.[0] ?? `DC-REG-${String(++legacy).padStart(3, "0")}`;
      this.ids.set(t.id, id);
      return {
        id,
        title: t.title,
        category: t.tags[0]?.replace("@", "") ?? "regression",
        file: t.location.file.replace(process.cwd() + "/", ""),
      };
    });
    mkdirSync("automation-results", { recursive: true });
    writeFileSync(
      "automation-results/inventory-playwright.json",
      JSON.stringify(this.inventory, null, 2),
    );
  }
  onTestEnd(test: TestCase, result: TestResult) {
    const timings = result.attachments
      .filter((a) => a.name === "browser-timing")
      .map((a) => {
        try {
          return JSON.parse(a.body?.toString() ?? readFileSync(a.path!, "utf8"));
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    const steps = (s: typeof result.steps): unknown[] =>
      s
        .filter((x) => x.category === "test.step")
        .map((x) => ({ title: x.title, duration: x.duration, steps: steps(x.steps) }));
    this.rows.push({
      id: this.ids.get(test.id),
      title: test.title,
      category: test.tags[0]?.replace("@", "") ?? "regression",
      status: result.status,
      expectedStatus: test.expectedStatus,
      durationMs: result.duration,
      retry: result.retry,
      steps: steps(result.steps),
      timings,
      annotations: test.annotations,
      attachments: result.attachments.map((a) => ({
        name: a.name,
        type: a.contentType,
        path: a.path?.replace(process.cwd() + "/", ""),
      })),
      error: result.error?.message?.replace(/\u001b\[[0-9;]*m/g, "").slice(0, 3000),
    });
  }
  onEnd(result: FullResult) {
    writeFileSync(
      "automation-results/functional.json",
      JSON.stringify(
        { status: result.status, expected: this.inventory.length, tests: this.rows },
        null,
        2,
      ),
    );
  }
}
