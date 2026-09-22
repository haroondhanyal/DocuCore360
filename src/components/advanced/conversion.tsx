"use client";
import { useProcessingHistory } from "@/hooks/use-processing-history";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Result } from "@/components/pdf/result";
import { openPdf } from "@/lib/pdf/browser";
import { textPdf, escapeHtml, csv } from "@/lib/advanced/conversion";
import { officePdf } from "@/lib/advanced/office-worker";
import { validateFile } from "@/lib/validation/files";
import type { Output } from "@/lib/pdf/types";
import { message } from "@/lib/utils";
export function Conversion({ id }: { id: string }) {
  const beginHistory = useProcessingHistory();
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<string[][]>([]);
  const [changes, setChanges] = useState<{ value: string; added?: boolean; removed?: boolean }[]>(
    [],
  );
  const [output, setOutput] = useState<Output>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sheet, setSheet] = useState("");
  const [tablePage, setTablePage] = useState(1);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);
  const ext = id.startsWith("docx")
    ? "docx"
    : id.startsWith("xlsx")
      ? "xlsx"
      : id.startsWith("html")
        ? "html"
        : id.startsWith("text")
          ? "txt"
          : "pdf";
  async function read(file: File, signal: AbortSignal) {
    const doc = await openPdf(await file.arrayBuffer());
    const stop = () => {
      void doc.loadingTask.destroy();
    };
    signal.addEventListener("abort", stop, { once: true });
    try {
      if (doc.numPages > 500) throw new Error("PDF exceeds 500 pages.");
      let result = "";
      for (let i = 1; i <= doc.numPages; i++) {
        signal.throwIfAborted();
        const p = await doc.getPage(i);
        const content = await p.getTextContent();
        const lines = new Map<number, { x: number; s: string }[]>();
        for (const item of content.items)
          if ("str" in item) {
            const y = Math.round(item.transform[5] / 3) * 3;
            lines.set(y, [...(lines.get(y) ?? []), { x: item.transform[4], s: item.str }]);
          }
        const ordered = [...lines]
          .sort((a, b) => b[0] - a[0])
          .map(([, v]) => v.sort((a, b) => a.x - b.x).map((t) => t.s));
        if (id === "pdf-tables" && i === tablePage)
          setRows(ordered.filter((r) => r.some((s) => s.trim())).slice(0, 200));
        result += ordered.map((r) => r.join(" ")).join("\n") + "\n\n";
        if (result.length > 2_000_000)
          throw new Error("Extracted text exceeds 2 million characters.");
        setProgress(i / doc.numPages);
      }
      return result;
    } finally {
      signal.removeEventListener("abort", stop);
      await doc.loadingTask.destroy();
    }
  }
  async function select(list: FileList | null) {
    setError("");
    setOutput(undefined);
    setRows([]);
    setChanges([]);
    try {
      const fs = Array.from(list ?? []);
      if (fs.length > (id === "compare-pdf" ? 2 : 1))
        throw new Error("Choose only the required files.");
      for (const f of fs) {
        if (!f.name.toLowerCase().endsWith("." + ext) || f.size <= 0 || f.size > 25 * 1024 * 1024)
          throw new Error(`Choose a non-empty ${ext.toUpperCase()} file up to 25 MB.`);
        if (ext === "pdf")
          validateFile(f.name, f.type, f.size, new Uint8Array(await f.slice(0, 12).arrayBuffer()));
      }
      setFiles(fs);
    } catch (e) {
      setFiles([]);
      setError(message(e));
    }
  }
  async function run() {
    const c = new AbortController();
    ctrl.current = c;
    setBusy(true);
    setError("");
    setProgress(0);
    const finishHistory = beginHistory(files[0]?.name ?? "");
    let outcome: "COMPLETED" | "FAILED" | "CANCELLED" = "COMPLETED";
    try {
      let content = text;
      let bytes: Uint8Array | undefined,
        mime = "application/pdf",
        name = `${id}.pdf`,
        notice =
          "Best-effort reconstructed layout. DOCX headings, paragraphs, tables and embedded JPEG/PNG images are supported; spreadsheet values use bordered tables. Exact pagination, charts and complex styling are not preserved.";
      if (ext === "docx" || ext === "xlsx") {
        const data = new Uint8Array(await files[0].arrayBuffer());
        const result = await officePdf(data, ext, sheet, c.signal, setProgress);
        bytes = result.bytes;
        if (result.replacements)
          notice += ` ${result.replacements} unsupported characters were replaced with ?.`;
      } else if (ext === "html" || ext === "txt") {
        if (files[0]) content = await files[0].text();
        if (ext === "html") {
          const { default: sanitize } = await import("sanitize-html");
          const safe = sanitize(content, {
            allowedTags: [],
            allowedAttributes: {},
            nonTextTags: [
              "script",
              "style",
              "textarea",
              "option",
              "iframe",
              "object",
              "svg",
              "math",
            ],
            textFilter: (value) => value,
          });
          const doc = new DOMParser().parseFromString(safe, "text/html");
          content = doc.body.textContent ?? "";
        }
      } else {
        content = await read(files[0], c.signal);
        if (id === "compare-pdf") {
          const second = await read(files[1], c.signal);
          const { diffLines } = await import("diff");
          setChanges(
            diffLines(content, second, { timeout: 2000 }) ?? [
              { value: "Comparison exceeded the time limit. Try smaller documents." },
            ],
          );
          return;
        }
        if (id === "pdf-tables") return;
        if (id === "pdf-to-docx") {
          const { Document, Packer, Paragraph } = await import("docx");
          bytes = new Uint8Array(
            await Packer.toBuffer(
              new Document({
                sections: [{ children: content.split("\n").map((t) => new Paragraph(t)) }],
              }),
            ),
          );
          mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          name = "converted.docx";
        } else if (id === "pdf-to-text" || id === "pdf-to-html") {
          const html = id === "pdf-to-html";
          bytes = new TextEncoder().encode(
            html
              ? `<!doctype html><html lang="en"><meta charset="utf-8"><title>Extracted PDF text</title><body><pre>${escapeHtml(content)}</pre></body></html>`
              : content,
          );
          mime = html ? "text/html" : "text/plain";
          name = html ? "converted.html" : "converted.txt";
        }
      }
      c.signal.throwIfAborted();
      if (!bytes) {
        const result = await textPdf(content);
        bytes = result.bytes;
        if (result.replacements)
          notice += ` ${result.replacements} unsupported characters were replaced with ?.`;
      }
      setOutput({ historyRecorded: true, bytes, name, mime, notice });
    } catch (e) {
      outcome = c.signal.aborted ? "CANCELLED" : "FAILED";
      setError(c.signal.aborted ? "Conversion cancelled." : message(e));
    } finally {
      finishHistory(outcome);
      setBusy(false);
    }
  }
  async function table(format: "csv" | "xlsx") {
    setBusy(true);
    setError("");
    try {
      if (format === "csv")
        setOutput({
          bytes: new TextEncoder().encode(csv(rows)),
          name: "table.csv",
          mime: "text/csv",
        });
      else {
        const Excel = await import("exceljs");
        const book = new Excel.Workbook();
        book.addWorksheet("Table").addRows(rows);
        setOutput({
          bytes: new Uint8Array(await book.xlsx.writeBuffer()),
          name: "table.xlsx",
          mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (output) return <Result output={output} onReset={() => setOutput(undefined)} />;
  return (
    <div className="form-stack">
      <p className="notice">
        {id === "pdf-tables"
          ? "Experimental table detection groups digital text by line and position. Review and edit cells before exporting. Scans need OCR first."
          : id === "compare-pdf"
            ? "Compares extracted digital text. Visual, image and formatting changes are not detected."
            : "Local, best-effort conversion. Word headings, tables and inline images and spreadsheet values are supported. Complex pagination, charts and styling may change. PDF-to-Word extracts text. Macros are rejected and formulas are never executed."}
      </p>
      <label className="panel">
        Choose {id === "compare-pdf" ? "two PDF files" : ext.toUpperCase() + " file"}
        <input
          aria-label="Choose files"
          type="file"
          accept={"." + ext}
          multiple={id === "compare-pdf"}
          disabled={busy}
          onChange={(e) => void select(e.target.files)}
        />
      </label>
      {files.map((f) => (
        <p key={f.name}>{f.name}</p>
      ))}
      {(ext === "html" || ext === "txt") && (
        <label>
          Or paste content
          <textarea
            className="field w-full"
            rows={12}
            maxLength={2_000_000}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setFiles([]);
            }}
          />
        </label>
      )}
      {ext === "xlsx" && (
        <label>
          Sheet name (blank = all)
          <input className="field" value={sheet} onChange={(e) => setSheet(e.target.value)} />
        </label>
      )}
      {id === "pdf-tables" && (
        <label>
          Page number
          <input
            className="field"
            type="number"
            min={1}
            max={500}
            value={tablePage}
            onChange={(e) => setTablePage(Math.max(1, Number(e.target.value)))}
          />
        </label>
      )}
      <Button
        disabled={busy || (id === "compare-pdf" ? files.length !== 2 : !files.length && !text)}
        onClick={() => void run()}
      >
        {id === "pdf-tables"
          ? "Detect table"
          : id === "compare-pdf"
            ? "Compare documents"
            : "Convert document"}
      </Button>
      {busy && (
        <>
          <progress max={1} value={progress} aria-label="Conversion progress" />
          <Button variant="secondary" onClick={() => ctrl.current?.abort()}>
            Cancel
          </Button>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {rows.length > 0 && (
        <>
          <div className="panel overflow-auto">
            <table className="data-table">
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>
                        <input
                          aria-label={`Row ${i + 1} column ${j + 1}`}
                          value={cell}
                          onChange={(e) =>
                            setRows(
                              rows.map((r, n) =>
                                n === i ? r.map((v, k) => (k === j ? e.target.value : v)) : r,
                              ),
                            )
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
            <Button disabled={busy} onClick={() => void table("csv")}>
              Export CSV
            </Button>
            <Button disabled={busy} onClick={() => void table("xlsx")}>
              Export XLSX
            </Button>
          </div>
        </>
      )}
      {changes.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {(["Before", "After"] as const).map((side) => (
            <section className="panel min-w-0" key={side} aria-label={side + " comparison"}>
              <h2>{side}</h2>
              {changes
                .filter((c) => (side === "Before" ? !c.added : !c.removed))
                .map((c, i) => (
                  <pre
                    key={i}
                    style={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      background: c.added ? "#dcfce7" : c.removed ? "#fee2e2" : undefined,
                      color: c.added || c.removed ? "#111" : undefined,
                    }}
                  >
                    {c.added ? "+ " : c.removed ? "− " : "  "}
                    {c.value}
                  </pre>
                ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
