"use client";
import { PasswordInput } from "@/components/ui/password-input";
import { useProcessingHistory } from "@/hooks/use-processing-history";
import { useRef, useState, useEffect } from "react";
import { Dropzone } from "@/components/upload/dropzone";
import { Button } from "@/components/ui/button";
import { Result } from "@/components/pdf/result";
import { inspectForms, type PdfAction } from "@/lib/advanced/pdf";
import { modifyPdfWorker } from "@/lib/advanced/worker";
import { securePdf } from "@/lib/advanced/security";
import { rasterPdf } from "@/lib/advanced/raster";
import type { Output } from "@/lib/pdf/types";
import { message, formatBytes } from "@/lib/utils";
import { RegionPicker, type Region } from "./region-picker";
export function AdvancedPdf({ id }: { id: string }) {
  const beginHistory = useProcessingHistory();
  const [file, setFile] = useState<File>();
  const [text, setText] = useState(
    id === "watermark-pdf" ? "CONFIDENTIAL" : id === "page-numbers" ? "{page} / {pages}" : "",
  );
  const [secondary, setSecondary] = useState("");
  const [pages, setPages] = useState("");
  const [size, setSize] = useState(id === "watermark-pdf" ? 40 : 12);
  const [opacity, setOpacity] = useState(0.3);
  const [flatten, setFlatten] = useState(false);
  const [clear, setClear] = useState(false);
  const [lossy, setLossy] = useState(false);
  const [password, setPassword] = useState("");
  const [fieldType, setFieldType] = useState<"text" | "checkbox" | "dropdown">("text");
  const [fieldChoices, setFieldChoices] = useState("");
  const [fields, setFields] = useState<Awaited<ReturnType<typeof inspectForms>>>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [regions, setRegions] = useState<Region[]>([]);
  const [region, setRegion] = useState({ page: 1, x: 10, y: 10, width: 50, height: 10 });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [output, setOutput] = useState<Output>();
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function select(files: File[]) {
    setError("");
    setFile(files[0]);
    setRegions([]);
    setOutput(undefined);
    if (id === "pdf-forms") {
      try {
        const f = await inspectForms(new Uint8Array(await files[0].arrayBuffer()));
        setFields(f);
        setValues(Object.fromEntries(f.map((x) => [x.name, x.value])));
      } catch (e) {
        setError(message(e));
      }
    }
  }
  async function run() {
    if (!file) return;
    setBusy(true);
    setError("");
    setProgress(0);
    const c = new AbortController();
    controller.current = c;
    const finishHistory = beginHistory(typeof file !== "undefined" ? file?.name : "");
    let outcome: "COMPLETED" | "FAILED" | "CANCELLED" = "COMPLETED";
    try {
      const input = new Uint8Array(await file.arrayBuffer());
      const raster = id === "redact-pdf" || lossy;
      const bytes = ["protect-pdf", "unlock-pdf"].includes(id)
        ? await securePdf(input, id, password, c.signal)
        : raster
          ? await rasterPdf(
              file,
              password,
              c.signal,
              setProgress,
              id === "redact-pdf" ? (regions.length ? regions : [region]) : undefined,
            )
          : await modifyPdfWorker(
              input,
              id as PdfAction,
              {
                text,
                secondary,
                pages,
                size,
                opacity,
                flatten,
                fields: values,
                clear,
                newField: {
                  type: fieldType,
                  region: regions[0],
                  options: fieldChoices
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                },
              },
              c.signal,
            );
      c.signal.throwIfAborted();
      setOutput({
        historyRecorded: true,
        bytes,
        name: `${id}-${file.name}`,
        mime: "application/pdf",
        saveable: id !== "protect-pdf",
        notice:
          id === "protect-pdf"
            ? "AES-256 password protection. Keep your password safe; it cannot be recovered. Download this encrypted result; My Files currently accepts unlocked PDFs only."
            : id === "unlock-pdf"
              ? "Encryption removed using the supplied password. Original text, images and page structure are preserved."
              : raster
                ? "Raster reconstruction: all original text, forms, links, attachments and metadata are discarded. Output contains page images only. Check every page before sharing."
                : id === "compress-pdf"
                  ? `Original ${formatBytes(file.size)}; result ${formatBytes(bytes.length)}. Structural optimization keeps the original when no size saving is possible.`
                  : id === "metadata-pdf"
                    ? "Document information and top-level XMP only. This is not a full privacy scrub of annotations or embedded content."
                    : undefined,
      });
    } catch (e) {
      outcome = c.signal.aborted ? "CANCELLED" : "FAILED";
      setError(c.signal.aborted ? "Processing cancelled." : message(e));
    } finally {
      finishHistory(outcome);
      setBusy(false);
    }
  }
  if (output) return <Result output={output} onReset={() => setOutput(undefined)} />;
  return (
    <div className="tool-layout">
      <div className="form-stack">
        <Dropzone onFiles={select} disabled={busy} />
        {["redact-pdf", "pdf-forms"].includes(id) && file && (
          <RegionPicker
            mode={id === "pdf-forms" ? "form" : "redact"}
            file={file}
            regions={regions}
            onChange={setRegions}
            disabled={busy}
          />
        )}
      </div>
      <section className="panel form-stack">
        <h2>Document options</h2>
        {file && <p>{file.name}</p>}
        {!["compress-pdf", "redact-pdf", "unlock-pdf", "protect-pdf"].includes(id) && (
          <>
            <label>
              {id === "metadata-pdf"
                ? "Title"
                : id === "pdf-forms"
                  ? "New field name (optional)"
                  : "Text"}
              <input
                className="field"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={250}
              />
            </label>
            {["header-footer", "metadata-pdf", "pdf-forms"].includes(id) && (
              <label>
                {id === "metadata-pdf"
                  ? "Author"
                  : id === "pdf-forms"
                    ? "New field value"
                    : "Footer"}
                <input
                  className="field"
                  value={secondary}
                  onChange={(e) => setSecondary(e.target.value)}
                  maxLength={250}
                />
              </label>
            )}
            <label>
              Page ranges (blank = all)
              <input
                className="field"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                placeholder="1-3, 5"
              />
            </label>
          </>
        )}
        {["watermark-pdf", "page-numbers", "header-footer"].includes(id) && (
          <label>
            Font size
            <input
              className="field"
              type="number"
              min={6}
              max={120}
              value={size}
              onChange={(e) => setSize(Math.max(6, Math.min(120, Number(e.target.value))))}
            />
          </label>
        )}
        {id === "watermark-pdf" && (
          <label>
            Opacity
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
            />
          </label>
        )}
        {id === "metadata-pdf" && (
          <label>
            <input type="checkbox" checked={clear} onChange={(e) => setClear(e.target.checked)} />{" "}
            Remove descriptive metadata
          </label>
        )}
        {id === "pdf-forms" && (
          <>
            <label>
              New field type
              <select
                className="field"
                value={fieldType}
                onChange={(e) => setFieldType(e.target.value as typeof fieldType)}
              >
                <option value="text">Text</option>
                <option value="checkbox">Checkbox</option>
                <option value="dropdown">Dropdown</option>
              </select>
            </label>
            {fieldType === "dropdown" && (
              <label>
                Dropdown choices (comma-separated)
                <input
                  className="field"
                  value={fieldChoices}
                  onChange={(e) => setFieldChoices(e.target.value)}
                />
              </label>
            )}
            {fields.map((f) => (
              <label key={f.name}>
                {f.name}
                {f.type === "checkbox" ? (
                  <input
                    type="checkbox"
                    checked={values[f.name] === "true"}
                    onChange={(e) => setValues({ ...values, [f.name]: String(e.target.checked) })}
                  />
                ) : f.options.length ? (
                  <select
                    className="field"
                    value={values[f.name]}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  >
                    <option value="">Choose</option>
                    {f.options.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="field"
                    value={values[f.name]}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  />
                )}
              </label>
            ))}
            <label>
              <input
                type="checkbox"
                checked={flatten}
                onChange={(e) => setFlatten(e.target.checked)}
              />{" "}
              Flatten fields into page content
            </label>
            <p className="notice">
              AcroForm fields only; XFA and rich text are unsupported. Draw a rectangle on the
              preview to position a new text, checkbox or dropdown field. Without a rectangle, the
              field appears at the bottom of the first selected page.
            </p>
          </>
        )}
        {id === "compress-pdf" && (
          <label>
            <input type="checkbox" checked={lossy} onChange={(e) => setLossy(e.target.checked)} />{" "}
            Lossy page-image compression (removes searchable text, forms and links)
          </label>
        )}
        {["unlock-pdf", "protect-pdf"].includes(id) && (
          <>
            <label>
              Document password
              <PasswordInput
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <p className="notice">
              {id === "protect-pdf"
                ? "Requires a password of at least 12 characters. AES-256 encryption runs in a local worker."
                : "Requires the correct password. Removes encryption while preserving document content."}
            </p>
          </>
        )}
        {id === "redact-pdf" && (
          <>
            <p className="notice">
              Permanent raster redaction. Coordinates are percentages measured from the top-left of
              the displayed page. Page 0 applies the rectangle to every page. Download and inspect
              the output before sharing. When marked regions exist, all marked regions are applied;
              otherwise the coordinate rectangle below is used.
            </p>
            <Button
              variant="secondary"
              disabled={busy || regions.length >= 100}
              onClick={() => setRegions([...regions, region])}
            >
              Add coordinate region
            </Button>
            {Object.entries(region).map(([k, v]) => (
              <label key={k}>
                {k}
                <input
                  className="field"
                  type="number"
                  min={0}
                  max={k === "page" ? 100 : 100}
                  value={v}
                  onChange={(e) =>
                    setRegion({
                      ...region,
                      [k]: Math.max(0, Math.min(k === "page" ? 100 : 100, Number(e.target.value))),
                    })
                  }
                />
              </label>
            ))}
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {busy && <progress max={1} value={progress} aria-label="Processing progress" />}
        <Button
          disabled={
            !file ||
            busy ||
            (id === "protect-pdf" && password.length < 12) ||
            (id === "redact-pdf" &&
              (region.width <= 0 ||
                region.height <= 0 ||
                region.x + region.width > 100 ||
                region.y + region.height > 100))
          }
          onClick={() => void run()}
        >
          {busy ? "Processing…" : "Process PDF"}
        </Button>
        {busy && (
          <Button variant="secondary" onClick={() => controller.current?.abort()}>
            Cancel
          </Button>
        )}
      </section>
    </div>
  );
}
