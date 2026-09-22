"use client";
import { useProcessingHistory } from "@/hooks/use-processing-history";
import { useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Dropzone } from "@/components/upload/dropzone";
import { Button } from "@/components/ui/button";
import { recognize, imageCanvas } from "@/lib/advanced/ocr";
import { renderPages } from "@/lib/advanced/raster";
import { downloadBytes, canvasBlob } from "@/lib/pdf/browser";
import { message } from "@/lib/utils";
import { unicodeFont } from "@/lib/advanced/fonts";
export function OcrTool() {
  const beginHistory = useProcessingHistory();
  const [language, setLanguage] = useState("eng");
  const [files, setFiles] = useState<File[]>([]);
  const [file, setFile] = useState<File>();
  const [text, setText] = useState("");
  const [pdf, setPdf] = useState<Uint8Array>();
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);
  async function run() {
    if (!file) return;
    setBusy(true);
    setError("");
    setPdf(undefined);
    setText("");
    setProgress(0);
    const c = new AbortController();
    ctrl.current = c;
    const finishHistory = beginHistory(typeof file !== "undefined" ? file?.name : "");
    let outcome: "COMPLETED" | "FAILED" | "CANCELLED" = "COMPLETED";
    try {
      const out = await PDFDocument.create();
      const font = await unicodeFont(
        out,
        ["urd", "ara"].includes(language) ? "arabic" : language === "hin" ? "devanagari" : "latin",
      );
      let combined = "";
      let total = 0;
      const page = async (canvas: HTMLCanvasElement, index: number, count: number) => {
        const data = await recognize(
          canvas,
          c.signal,
          (n) => setProgress((index + n) / count),
          language,
        );
        combined += data.text + "\n\n";
        setText(combined);
        const bytes = new Uint8Array(
          await (await canvasBlob(canvas, "image/jpeg", 0.88)).arrayBuffer(),
        );
        total += bytes.length;
        if (total > 150 * 1024 * 1024) throw new Error("OCR output exceeds 150 MB.");
        const img = await out.embedJpg(bytes);
        const p = out.addPage([canvas.width * 0.5, canvas.height * 0.5]);
        p.drawImage(img, { x: 0, y: 0, width: p.getWidth(), height: p.getHeight() });
        for (const block of data.blocks ?? [])
          for (const paragraph of block.paragraphs)
            for (const line of paragraph.lines)
              for (const word of line.words) {
                const s = Math.max(3, (word.bbox.y1 - word.bbox.y0) * 0.5);
                try {
                  font.encodeText(word.text);
                  p.drawText(word.text, {
                    x: word.bbox.x0 * 0.5,
                    y: p.getHeight() - word.bbox.y1 * 0.5,
                    size: s,
                    font,
                    opacity: 0,
                  });
                } catch {
                  /* Characters unsupported by the Latin search font remain visible in the image. */
                }
              }
      };
      if (file.type === "application/pdf") await renderPages(file, "", c.signal, page, 2);
      else {
        for (let i = 0; i < files.length; i++) {
          c.signal.throwIfAborted();
          const canvas = await imageCanvas(files[i]);
          await page(canvas, i, files.length);
          canvas.width = canvas.height = 1;
        }
      }
      c.signal.throwIfAborted();
      setPdf(await out.save());
      setProgress(1);
    } catch (e) {
      outcome = c.signal.aborted ? "CANCELLED" : "FAILED";
      setError(c.signal.aborted ? "OCR cancelled." : message(e));
    } finally {
      finishHistory(outcome);
      setBusy(false);
    }
  }
  async function word() {
    try {
      const { Document, Packer, Paragraph, TextRun } = await import("docx");
      const b = await Packer.toBuffer(
        new Document({
          sections: [
            {
              children: text.split("\n").map((t) => new Paragraph({ children: [new TextRun(t)] })),
            },
          ],
        }),
      );
      downloadBytes(
        new Uint8Array(b),
        "recognized-text.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <div className="form-stack">
      <div className="notice">
        Multilingual OCR runs on your device using locally hosted language data. Review recognition
        errors. Searchable PDF keeps original recognition positions; edits below apply to text/DOCX
        exports only.
      </div>
      <label>
        OCR language
        <select
          className="field"
          value={language}
          disabled={busy}
          onChange={(e) => setLanguage(e.target.value)}
        >
          {Object.entries({
            eng: "English",
            urd: "Urdu",
            ara: "Arabic",
            hin: "Hindi",
            spa: "Spanish",
            fra: "French",
            deu: "German",
          }).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <Dropzone
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        multiple
        disabled={busy}
        onFiles={(f) => {
          if (f.length > 1 && f.some((v) => v.name.toLowerCase().endsWith(".pdf")))
            throw new Error("Choose one PDF or a batch of images.");
          setFiles(f);
          setFile(f[0]);
          setText("");
          setPdf(undefined);
        }}
      />
      {file && (
        <p>
          {file.name}
          {files.length > 1 ? ` and ${files.length - 1} more images` : ""}
        </p>
      )}
      <div className="flex gap-3">
        <Button disabled={!file || busy} onClick={() => void run()}>
          Recognize text
        </Button>
        {busy && (
          <Button variant="secondary" onClick={() => ctrl.current?.abort()}>
            Cancel OCR
          </Button>
        )}
      </div>
      {busy && <progress aria-label="OCR progress" max={1} value={progress} />}
      <p role="status">
        {busy ? `${Math.round(progress * 100)}% recognized` : pdf ? "Recognition complete" : ""}
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {pdf && (
        <>
          <label>
            Recognized text
            <textarea
              aria-label="Recognized text"
              className="field w-full"
              rows={15}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={() =>
                downloadBytes(new TextEncoder().encode(text), "recognized-text.txt", "text/plain")
              }
            >
              Download text
            </Button>
            <Button variant="secondary" onClick={() => void word()}>
              Download DOCX
            </Button>
            <Button
              variant="secondary"
              onClick={() => downloadBytes(pdf, "searchable.pdf", "application/pdf")}
            >
              Download searchable PDF
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
