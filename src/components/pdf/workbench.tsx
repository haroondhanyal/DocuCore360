"use client";
import { useProcessingHistory } from "@/hooks/use-processing-history";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  Copy,
  FilePlus2,
  FileText,
  GripVertical,
  LoaderCircle,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo2,
  Redo2,
  X,
  ArrowRight,
} from "lucide-react";
import type { ToolDefinition } from "@/config/tools";
import { Dropzone } from "@/components/upload/dropzone";
import { Button } from "@/components/ui/button";
import { PageCanvas } from "@/components/pdf/page-canvas";
import { Result } from "@/components/pdf/result";
import type { ImageOptions, ImageSource, Output, PageSpec, PdfSource } from "@/lib/pdf/types";
import { canvasBlob, openPdf } from "@/lib/pdf/browser";
import { parsePageRanges, splitGroups } from "@/lib/pdf/core";
import { processPdf } from "@/lib/pdf/worker-client";
import { takePendingFiles } from "@/lib/pending-file";
import { formatBytes, message } from "@/lib/utils";
type LoadedSource = PdfSource & { doc: PDFDocumentProxy };
type LoadedImage = ImageSource & { url: string };
export function PdfWorkbench({ tool }: { tool: ToolDefinition }) {
  const beginHistory = useProcessingHistory();
  const [sources, setSources] = useState<LoadedSource[]>([]);
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [pages, setPages] = useState<PageSpec[]>([]);
  const [past, setPast] = useState<PageSpec[][]>([]);
  const [future, setFuture] = useState<PageSpec[][]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [output, setOutput] = useState<Output | null>(null);
  const [range, setRange] = useState("");
  const [splitMode, setSplitMode] = useState("selected");
  const [interval, setIntervalValue] = useState(1);
  const [format, setFormat] = useState("png");
  const [dpi, setDpi] = useState(144);
  const [quality, setQuality] = useState(0.9);
  const [transparent, setTransparent] = useState(false);
  const [imageOptions, setImageOptions] = useState<ImageOptions>({
    size: "a4",
    orientation: "portrait",
    margin: 24,
    fit: "fit",
    width: 595,
    height: 842,
  });
  const controller = useRef<AbortController | null>(null);
  const sourceRef = useRef(sources);
  const imageRef = useRef(images);
  const dragId = useRef("");
  const anchor = useRef(0);
  const initialized = useRef(false);
  const isImages = tool.kind === "image-to-pdf";
  const isOrganizer = tool.kind === "organize" || tool.kind === "merge";
  const loaded = isImages ? images.length > 0 : sources.length > 0;
  useEffect(() => {
    sourceRef.current = sources;
    imageRef.current = images;
  }, [sources, images]);
  useEffect(
    () => () => {
      controller.current?.abort();
      sourceRef.current.forEach((s) => void s.doc.loadingTask.destroy());
      imageRef.current.forEach((i) => URL.revokeObjectURL(i.url));
    },
    [],
  );
  useEffect(() => {
    if (!loaded || output) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [loaded, output]);
  function edit(next: PageSpec[]) {
    setPast((p) => [...p.slice(-29), pages]);
    setFuture([]);
    setPages(next);
  }
  function undo() {
    const prev = past.at(-1);
    if (!prev) return;
    setFuture((f) => [pages, ...f]);
    setPages(prev);
    setPast((p) => p.slice(0, -1));
  }
  function redo() {
    const next = future[0];
    if (!next) return;
    setPast((p) => [...p, pages]);
    setPages(next);
    setFuture((f) => f.slice(1));
  }
  function shift<T>(list: T[], index: number, delta: number) {
    const next = [...list];
    const target = index + delta;
    if (target < 0 || target >= next.length) return next;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  }
  const addFiles = useCallback(
    async (files: File[]) => {
      setError("");
      setLoading(true);
      const freshDocs: LoadedSource[] = [];
      const freshImages: LoadedImage[] = [];
      try {
        if ((isImages ? imageRef.current.length : sourceRef.current.length) + files.length > 20)
          throw new Error("Use at most 20 input files per operation.");
        const existingBytes = isImages
          ? imageRef.current.reduce((n, i) => n + i.bytes.byteLength, 0)
          : sourceRef.current.reduce((n, s) => n + s.bytes.byteLength, 0);
        if (existingBytes + files.reduce((n, f) => n + f.size, 0) > 100 * 1024 * 1024)
          throw new Error("Keep total inputs below 100 MB.");
        for (const file of files) {
          if (isImages) {
            const bitmap = await createImageBitmap(file);
            try {
              if (bitmap.width * bitmap.height > 40_000_000)
                throw new Error("Use images with fewer than 40 million pixels.");
              const canvas = document.createElement("canvas");
              canvas.width = bitmap.width;
              canvas.height = bitmap.height;
              const ctx = canvas.getContext("2d");
              if (!ctx) throw new Error("Canvas is unavailable in this browser.");
              ctx.drawImage(bitmap, 0, 0);
              const type = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
              const blob = await canvasBlob(canvas, type, 1);
              const bytes = await blob.arrayBuffer();
              freshImages.push({
                id: crypto.randomUUID(),
                name: file.name,
                bytes,
                width: bitmap.width,
                height: bitmap.height,
                type,
                url: URL.createObjectURL(blob),
              });
              canvas.width = 0;
              canvas.height = 0;
            } finally {
              bitmap.close();
            }
          } else {
            const bytes = await file.arrayBuffer();
            let doc: PDFDocumentProxy;
            try {
              doc = await openPdf(bytes);
            } catch (e) {
              if (e instanceof Error && /password/i.test(e.message))
                throw new Error(
                  "This PDF is encrypted. Open it in PDF Reader with your password; structural editing is not supported for encrypted files.",
                );
              throw new Error("We couldn't open this PDF. It may be corrupted or unsupported.");
            }
            if (doc.numPages > 500 || doc.numPages < 1) {
              await doc.loadingTask.destroy();
              throw new Error("Use PDFs with 1–500 pages.");
            }
            freshDocs.push({
              id: crypto.randomUUID(),
              name: file.name,
              bytes,
              count: doc.numPages,
              doc,
            });
          }
        }
        if (isImages) setImages((prev) => [...prev, ...freshImages]);
        else {
          const base = isOrganizer ? sourceRef.current : [];
          if ([...base, ...freshDocs].reduce((n, s) => n + s.count, 0) > 500)
            throw new Error("Use up to 500 pages total per operation.");
          if (!isOrganizer) sourceRef.current.forEach((s) => void s.doc.loadingTask.destroy());
          setSources([...base, ...freshDocs]);
          const added = freshDocs.flatMap((s) =>
            Array.from({ length: s.count }, (_, i) => ({
              id: crypto.randomUUID(),
              sourceId: s.id,
              pageIndex: i,
              rotation: 0,
            })),
          );
          setPages((prev) => (isOrganizer ? [...prev, ...added] : added));
          setPast([]);
          setFuture([]);
          setSelected([]);
        }
      } catch (e) {
        freshDocs.forEach((s) => void s.doc.loadingTask.destroy());
        freshImages.forEach((i) => URL.revokeObjectURL(i.url));
        setError(message(e));
      } finally {
        setLoading(false);
      }
    },
    [isImages, isOrganizer],
  );
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const files = takePendingFiles();
    if (files.length)
      queueMicrotask(() => {
        void addFiles(files);
      });
  }, [addFiles]);
  function togglePage(id: string, index: number, event: React.MouseEvent) {
    if (event.shiftKey) {
      const ids = pages
        .slice(Math.min(anchor.current, index), Math.max(anchor.current, index) + 1)
        .map((p) => p.id);
      setSelected((prev) => Array.from(new Set([...prev, ...ids])));
    } else {
      setSelected((prev) =>
        prev.includes(id)
          ? prev.filter((x) => x !== id)
          : event.ctrlKey || event.metaKey
            ? [...prev, id]
            : [...prev, id],
      );
      anchor.current = index;
    }
  }
  function moveSource(index: number, delta: number) {
    const reordered = shift(sources, index, delta);
    setSources(reordered);
    edit([
      ...reordered.flatMap((s) => pages.filter((p) => p.sourceId === s.id)),
      ...pages.filter((p) => p.sourceId === null),
    ]);
  }
  async function run() {
    setError("");
    setProcessing(true);
    setProgress(0);
    const abort = new AbortController();
    controller.current = abort;
    const finishHistory = beginHistory(sources[0]?.name ?? images[0]?.name ?? "");
    let outcome: "COMPLETED" | "FAILED" | "CANCELLED" = "COMPLETED";
    try {
      let result: Output;
      const plainSources = sources.map(({ id, name, bytes, count }) => ({
        id,
        name,
        bytes,
        count,
      }));
      if (isImages) {
        const prepared: ImageSource[] = [];
        for (const item of images) {
          if (abort.signal.aborted) throw new Error("Processing cancelled.");
          if (quality >= 1 && item.type === "image/png") prepared.push(item);
          else {
            const bitmap = await createImageBitmap(new Blob([item.bytes]));
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext("2d")!;
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(bitmap, 0, 0);
            bitmap.close();
            const blob = await canvasBlob(canvas, "image/jpeg", quality);
            prepared.push({ ...item, type: "image/jpeg", bytes: await blob.arrayBuffer() });
            canvas.width = 0;
          }
        }
        result = await processPdf(
          { kind: "images", images: prepared, options: imageOptions },
          setProgress,
          abort.signal,
        );
      } else if (isOrganizer) {
        result = await processPdf(
          {
            kind: "organize",
            sources: plainSources,
            pages,
            name:
              tool.kind === "merge"
                ? "documents-merged.pdf"
                : `${sources[0].name.replace(/\.pdf$/i, "")}-organized.pdf`,
          },
          setProgress,
          abort.signal,
        );
      } else if (tool.kind === "split") {
        const source = plainSources[0];
        result = await processPdf(
          {
            kind: "split",
            source,
            groups: splitGroups(splitMode, source.count, range, interval),
            name: source.name.replace(/\.pdf$/i, ""),
          },
          setProgress,
          abort.signal,
        );
      } else {
        const source = sources[0];
        const chosen = parsePageRanges(range, source.count);
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        let lastBytes = new Uint8Array();
        let lastName = "";
        let totalBytes = 0;
        for (let i = 0; i < chosen.length; i++) {
          if (abort.signal.aborted) throw new Error("Processing cancelled.");
          const page = await source.doc.getPage(chosen[i] + 1);
          const viewport = page.getViewport({ scale: dpi / 72 });
          if (viewport.width * viewport.height > 40_000_000)
            throw new Error(
              "This page is too large at the selected DPI. Choose a lower resolution.",
            );
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const task = page.render({
            canvas,
            viewport,
            background: transparent && format !== "jpeg" ? "rgba(0,0,0,0)" : "white",
          });
          const cancel = () => task.cancel();
          abort.signal.addEventListener("abort", cancel, { once: true });
          try {
            await task.promise;
          } finally {
            finishHistory(abort.signal.aborted ? "CANCELLED" : outcome);
            abort.signal.removeEventListener("abort", cancel);
          }
          const blob = await canvasBlob(canvas, `image/${format}`, quality);
          if (blob.type !== `image/${format}`)
            throw new Error(`Your browser cannot export ${format.toUpperCase()}. Try PNG.`);
          lastBytes = new Uint8Array(await blob.arrayBuffer());
          totalBytes += lastBytes.length;
          if (totalBytes > 200 * 1024 * 1024)
            throw new Error("Output exceeds 200 MB. Export fewer pages or lower the DPI.");
          lastName = `${source.name.replace(/\.pdf$/i, "")}-page-${chosen[i] + 1}.${format === "jpeg" ? "jpg" : format}`;
          zip.file(lastName, lastBytes);
          canvas.width = 0;
          canvas.height = 0;
          setProgress(Math.round(((i + 1) / chosen.length) * 90));
        }
        if (abort.signal.aborted) throw new Error("Processing cancelled.");
        result =
          chosen.length === 1
            ? { bytes: lastBytes, name: lastName, mime: `image/${format}` }
            : {
                bytes: await zip.generateAsync({ type: "uint8array" }),
                name: `${source.name.replace(/\.pdf$/i, "")}-images.zip`,
                mime: "application/zip",
              };
        setProgress(100);
      }
      if (!abort.signal.aborted) setOutput({ ...result, historyRecorded: true });
    } catch (e) {
      outcome = abort.signal.aborted ? "CANCELLED" : "FAILED";
      setError(
        abort.signal.aborted
          ? "Processing cancelled. Your inputs are still available."
          : message(e),
      );
    } finally {
      setProcessing(false);
      controller.current = null;
    }
  }
  function reset() {
    sources.forEach((s) => void s.doc.loadingTask.destroy());
    images.forEach((i) => URL.revokeObjectURL(i.url));
    sourceRef.current = [];
    imageRef.current = [];
    setSources([]);
    setImages([]);
    setPages([]);
    setOutput(null);
    setPast([]);
    setFuture([]);
    setSelected([]);
    setError("");
  }
  if (output) return <Result output={output} onReset={reset} />;
  return (
    <>
      <div className="stepper">
        <span className={!loaded ? "active" : ""}>
          <b>1</b>Choose files
        </span>
        <span className={loaded && !processing ? "active" : ""}>
          <b>2</b>Configure & preview
        </span>
        <span className={processing ? "active" : ""}>
          <b>3</b>Process & download
        </span>
      </div>
      {error && (
        <div className="error mb-5" role="alert">
          {error}
        </div>
      )}
      <div className="tool-layout">
        <section>
          <Dropzone
            onFiles={addFiles}
            accept={isImages ? ".jpg,.jpeg,.png,.webp" : ".pdf"}
            multiple={isImages || isOrganizer}
            compact={loaded}
            disabled={loading || processing}
          />
          {loading && (
            <p className="muted text-xs flex gap-2 items-center mt-4">
              <LoaderCircle size={15} className="spin" />
              Preparing previews…
            </p>
          )}
          {isOrganizer && sources.length > 0 && (
            <>
              <div className="file-list">
                {sources.map((s, i) => (
                  <div className="file-row" key={s.id}>
                    <GripVertical size={15} />
                    <FileText size={20} />
                    <div className="file-info">
                      <strong>{s.name}</strong>
                      <small>
                        {s.count} pages · {formatBytes(s.bytes.byteLength)}
                      </small>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Move ${s.name} up`}
                      disabled={i === 0 || processing}
                      onClick={() => moveSource(i, -1)}
                    >
                      <ArrowUp size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Move ${s.name} down`}
                      disabled={i === sources.length - 1 || processing}
                      onClick={() => moveSource(i, 1)}
                    >
                      <ArrowDown size={14} />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="action-bar">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={processing}
                  onClick={() =>
                    setSelected(selected.length === pages.length ? [] : pages.map((p) => p.id))
                  }
                >
                  <CheckSquare size={14} />
                  {selected.length === pages.length ? "Clear selection" : "Select all"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!selected.length || processing}
                  onClick={() =>
                    edit(
                      pages.map((p) =>
                        selected.includes(p.id) ? { ...p, rotation: (p.rotation + 90) % 360 } : p,
                      ),
                    )
                  }
                >
                  <RotateCw size={14} />
                  Rotate
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!selected.length || processing}
                  onClick={() => {
                    edit(pages.filter((p) => !selected.includes(p.id)));
                    setSelected([]);
                  }}
                >
                  <Trash2 size={14} />
                  Delete
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!selected.length || processing}
                  onClick={() => {
                    edit(pages.filter((p) => selected.includes(p.id)));
                    setSelected([]);
                  }}
                >
                  Keep selected
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={processing}
                  onClick={() =>
                    edit([
                      ...pages,
                      { id: crypto.randomUUID(), sourceId: null, pageIndex: 0, rotation: 0 },
                    ])
                  }
                >
                  <FilePlus2 size={14} />
                  Blank page
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Undo"
                  disabled={!past.length || processing}
                  onClick={undo}
                >
                  <Undo2 size={16} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Redo"
                  disabled={!future.length || processing}
                  onClick={redo}
                >
                  <Redo2 size={16} />
                </Button>
              </div>
              <p className="text-[11px] muted">
                Drag pages to reorder. Select multiple pages, or Shift-click a range. Arrow buttons
                are available for keyboard users.
              </p>
              <div className="page-grid">
                {pages.map((p, i) => {
                  const source = sources.find((s) => s.id === p.sourceId);
                  return (
                    <div
                      className={`page-tile ${selected.includes(p.id) ? "selected" : ""}`}
                      key={p.id}
                      draggable={!processing}
                      onDragStart={() => {
                        dragId.current = p.id;
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from = pages.findIndex((x) => x.id === dragId.current);
                        if (from < 0 || processing) return;
                        const next = [...pages];
                        const [item] = next.splice(from, 1);
                        next.splice(i, 0, item);
                        edit(next);
                      }}
                    >
                      <button
                        className="w-full border-0 bg-transparent p-0"
                        aria-label={`Select page ${i + 1}`}
                        aria-pressed={selected.includes(p.id)}
                        disabled={processing}
                        onClick={(e) => togglePage(p.id, i, e)}
                      >
                        {source ? (
                          <PageCanvas
                            doc={source.doc}
                            pageNumber={p.pageIndex + 1}
                            rotation={p.rotation}
                            className="thumbnail"
                          />
                        ) : (
                          <div className="thumbnail text-xs muted">Blank A4 page</div>
                        )}
                        <span className="page-label">
                          <span>Page {i + 1}</span>
                          <span>{p.rotation}°</span>
                        </span>
                      </button>
                      <div className="page-actions">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Move page ${i + 1} earlier`}
                          disabled={i === 0 || processing}
                          onClick={() => edit(shift(pages, i, -1))}
                        >
                          <ArrowUp size={12} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Move page ${i + 1} later`}
                          disabled={i === pages.length - 1 || processing}
                          onClick={() => edit(shift(pages, i, 1))}
                        >
                          <ArrowDown size={12} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Rotate page ${i + 1} left`}
                          disabled={processing}
                          onClick={() =>
                            edit(
                              pages.map((x) =>
                                x.id === p.id ? { ...x, rotation: (x.rotation + 270) % 360 } : x,
                              ),
                            )
                          }
                        >
                          <RotateCcw size={12} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Rotate page ${i + 1} right`}
                          disabled={processing}
                          onClick={() =>
                            edit(
                              pages.map((x) =>
                                x.id === p.id ? { ...x, rotation: (x.rotation + 90) % 360 } : x,
                              ),
                            )
                          }
                        >
                          <RotateCw size={12} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Duplicate page ${i + 1}`}
                          disabled={processing}
                          onClick={() =>
                            edit([
                              ...pages.slice(0, i + 1),
                              { ...p, id: crypto.randomUUID() },
                              ...pages.slice(i + 1),
                            ])
                          }
                        >
                          <Copy size={12} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete page ${i + 1}`}
                          disabled={processing}
                          onClick={() => edit(pages.filter((x) => x.id !== p.id))}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {isImages && (
            <div className="page-grid">
              {images.map((item, i) => (
                <div
                  className="page-tile"
                  key={item.id}
                  draggable={!processing}
                  onDragStart={() => {
                    dragId.current = item.id;
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = images.findIndex((x) => x.id === dragId.current);
                    if (from < 0 || processing) return;
                    const next = [...images];
                    const [image] = next.splice(from, 1);
                    next.splice(i, 0, image);
                    setImages(next);
                  }}
                >
                  <img src={item.url} alt={item.name} />
                  <div className="page-label">
                    <span className="truncate">
                      {i + 1}. {item.name}
                    </span>
                  </div>
                  <small className="text-[9px]">
                    {item.width} × {item.height} px
                  </small>
                  <div className="page-actions">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Move image ${i + 1} earlier`}
                      disabled={!i || processing}
                      onClick={() => setImages(shift(images, i, -1))}
                    >
                      <ArrowUp size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Move image ${i + 1} later`}
                      disabled={i === images.length - 1 || processing}
                      onClick={() => setImages(shift(images, i, 1))}
                    >
                      <ArrowDown size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove image ${i + 1}`}
                      disabled={processing}
                      onClick={() => {
                        URL.revokeObjectURL(item.url);
                        setImages(images.filter((x) => x.id !== item.id));
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!isOrganizer && !isImages && sources[0] && (
            <>
              <div className="file-row mt-5">
                <FileText size={22} />
                <div className="file-info">
                  <strong>{sources[0].name}</strong>
                  <small>
                    {sources[0].count} pages · {formatBytes(sources[0].bytes.byteLength)}
                  </small>
                </div>
              </div>
              <div className="page-grid">
                {pages.map((p, i) => (
                  <div className="page-tile" key={p.id}>
                    <PageCanvas doc={sources[0].doc} pageNumber={i + 1} className="thumbnail" />
                    <div className="page-label">Page {i + 1}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
        <aside className="panel options-panel">
          <h2>
            {isImages
              ? "Page settings"
              : tool.kind === "split"
                ? "Split options"
                : tool.kind === "pdf-to-image"
                  ? "Export settings"
                  : "Your document"}
          </h2>
          {isOrganizer && (
            <>
              <p className="text-xs muted leading-6">
                Arrange pages exactly how you need them. All changes are exported to a new PDF.
              </p>
              <div className="flex justify-between text-xs">
                <span className="muted">Output pages</span>
                <strong>{pages.length}</strong>
              </div>
              <div className="flex justify-between text-xs">
                <span className="muted">Source files</span>
                <strong>{sources.length}</strong>
              </div>
              <small className="text-[10px] leading-5">
                Page operations may not preserve document-level bookmarks, form behavior or digital
                signatures. Check the exported document before sharing.
              </small>
            </>
          )}
          {tool.kind === "split" && (
            <>
              <label className="field">
                Split method
                <select value={splitMode} onChange={(e) => setSplitMode(e.target.value)}>
                  <option value="selected">Selected pages → one PDF</option>
                  <option value="ranges">Each range → separate PDF</option>
                  <option value="every">Every page → separate PDF</option>
                  <option value="odd">Odd pages</option>
                  <option value="even">Even pages</option>
                  <option value="interval">Every N pages</option>
                </select>
              </label>
              {["selected", "ranges"].includes(splitMode) && (
                <label className="field">
                  Page ranges
                  <input
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                    placeholder="1-3, 5, 8-12"
                  />
                  <small>
                    {splitMode === "selected"
                      ? "Leave blank to include every page."
                      : "Separate output groups with commas."}
                  </small>
                </label>
              )}
              {splitMode === "interval" && (
                <label className="field">
                  Pages per output
                  <input
                    type="number"
                    min={1}
                    max={sources[0]?.count ?? 500}
                    value={interval}
                    onChange={(e) => setIntervalValue(Number(e.target.value))}
                  />
                </label>
              )}
              <small>Multiple output documents download as a ZIP.</small>
            </>
          )}
          {tool.kind === "pdf-to-image" && (
            <>
              <label className="field">
                Image format
                <select value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option value="png">PNG</option>
                  <option value="jpeg">JPG</option>
                  <option value="webp">WebP</option>
                </select>
              </label>
              <label className="field">
                Resolution
                <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
                  <option value={72}>72 DPI · smaller files</option>
                  <option value={144}>144 DPI · recommended</option>
                  <option value={216}>216 DPI · detailed</option>
                  <option value={300}>300 DPI · high resolution</option>
                </select>
              </label>
              <label className="field">
                Pages
                <input
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  placeholder="All pages, or 1-3, 5"
                  aria-label="Pages"
                />
                <small>Blank means all pages.</small>
              </label>
              {format !== "jpeg" && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={transparent}
                    onChange={(e) => setTransparent(e.target.checked)}
                  />
                  Transparent background
                </label>
              )}
            </>
          )}
          {isImages && (
            <>
              <label className="field">
                Page size
                <select
                  value={imageOptions.size}
                  onChange={(e) =>
                    setImageOptions({
                      ...imageOptions,
                      size: e.target.value as ImageOptions["size"],
                    })
                  }
                >
                  <option value="a4">A4</option>
                  <option value="letter">US Letter</option>
                  <option value="original">Original dimensions (96 DPI)</option>
                  <option value="custom">Custom size</option>
                </select>
              </label>
              {imageOptions.size === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="field">
                    Width (pt)
                    <input
                      type="number"
                      min={1}
                      max={14400}
                      value={imageOptions.width}
                      onChange={(e) =>
                        setImageOptions({ ...imageOptions, width: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="field">
                    Height (pt)
                    <input
                      type="number"
                      min={1}
                      max={14400}
                      value={imageOptions.height}
                      onChange={(e) =>
                        setImageOptions({ ...imageOptions, height: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
              )}
              {imageOptions.size !== "original" && (
                <label className="field">
                  Orientation
                  <select
                    aria-label="Orientation"
                    value={imageOptions.orientation}
                    onChange={(e) =>
                      setImageOptions({
                        ...imageOptions,
                        orientation: e.target.value as ImageOptions["orientation"],
                      })
                    }
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </label>
              )}
              <label className="field">
                Margins (points)
                <input
                  type="number"
                  min={0}
                  max={144}
                  value={imageOptions.margin}
                  onChange={(e) =>
                    setImageOptions({ ...imageOptions, margin: Number(e.target.value) })
                  }
                />
                <small>72 points = 1 inch</small>
              </label>
              <label className="field">
                Image placement
                <select
                  value={imageOptions.fit}
                  onChange={(e) =>
                    setImageOptions({ ...imageOptions, fit: e.target.value as ImageOptions["fit"] })
                  }
                >
                  <option value="fit">Fit & center (keep entire image)</option>
                  <option value="fill">Fill & center (crop edges)</option>
                </select>
              </label>
            </>
          )}
          {(isImages || (tool.kind === "pdf-to-image" && format !== "png")) && (
            <label className="field">
              Image quality: {Math.round(quality * 100)}%
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
              />
              <small>Lower quality produces smaller image files.</small>
            </label>
          )}
          {processing ? (
            <>
              <div
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Processing progress"
                className="progress-track"
              >
                <div style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs muted">{progress}% · Processing your document</p>
              <Button variant="secondary" onClick={() => controller.current?.abort()}>
                <X size={14} />
                Cancel
              </Button>
            </>
          ) : (
            <Button
              onClick={() => void run()}
              disabled={!loaded || loading || (isOrganizer && !pages.length)}
            >
              {isImages
                ? "Create PDF"
                : tool.kind === "merge"
                  ? "Merge PDFs"
                  : tool.kind === "split"
                    ? "Split PDF"
                    : tool.kind === "organize"
                      ? "Export organized PDF"
                      : "Convert to images"}
              <ArrowRight size={15} />
            </Button>
          )}
          <p className="text-[10px] muted leading-5">
            On-device processing. Your files stay in this browser unless you explicitly save a
            result to your account.
          </p>
        </aside>
      </div>
    </>
  );
}
