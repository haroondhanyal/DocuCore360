"use client";
import { useProcessingHistory } from "@/hooks/use-processing-history";
import "./editor.css";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Canvas,
  FabricObject,
  FabricImage,
  Textbox,
  Rect,
  Ellipse,
  Line,
  Path,
  Point,
} from "fabric";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  MousePointer2,
  Type,
  ImagePlus,
  Square,
  Circle,
  Minus,
  ArrowUpRight,
  Highlighter,
  Pencil,
  Signature,
  ScanText,
  Eraser,
  Stamp,
  Undo2,
  Redo2,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  RotateCw,
  FilePlus2,
  ShieldCheck,
  X,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/upload/dropzone";
import { PageCanvas } from "@/components/pdf/page-canvas";
import { Result } from "@/components/pdf/result";
import { EditorCanvas } from "./editor-canvas";
import { EditorProperties } from "./properties";
import { SignatureDialog } from "./signature-dialog";
import { openPdf, canvasBlob } from "@/lib/pdf/browser";
import { renderEditorOverlays, assembleEditedPdf } from "@/lib/pdf/editor-browser";
import { takePendingFiles } from "@/lib/pending-file";
import { message } from "@/lib/utils";
import { validateFile } from "@/lib/validation/files";
import type { EditorPage, EditorTool, OverlayJSON } from "@/lib/pdf/editor-types";
import type { Output } from "@/lib/pdf/types";

import { EditorDraft } from "@/components/workspace/editor-draft";

const topLeft = { originX: "left" as const, originY: "top" as const };
type History = { past: EditorPage[][]; present: EditorPage[]; future: EditorPage[][] };
export function PdfEditor() {
  const beginHistory = useProcessingHistory();
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [name, setName] = useState("");
  const [draftBytes, setDraftBytes] = useState<ArrayBuffer | null>(null);
  const [pages, setPages] = useState<EditorPage[]>([]);
  const [activeId, setActiveId] = useState("");
  const [revision, setRevision] = useState(0);
  const [historyCounts, setHistoryCounts] = useState({ past: 0, future: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [output, setOutput] = useState<Output | null>(null);
  const [dirty, setDirty] = useState(false);
  const [tool, setTool] = useState<EditorTool>("select");
  const [color, setColor] = useState("#243444");
  const [brushWidth, setBrushWidth] = useState(3);
  const [zoom, setZoom] = useState(0.8);
  const [selected, setSelected] = useState<FabricObject | null>(null);
  const [, refreshProperties] = useState(0);
  const [ready, setReady] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const canvas = useRef<Canvas | null>(null);
  const original = useRef<ArrayBuffer | null>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const history = useRef<History>({ past: [], present: [], future: [] });
  const fileInput = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const initialized = useRef(false);
  const active = pages.find((p) => p.id === activeId) ?? pages[0];
  const activeIndex = pages.findIndex((p) => p.id === active?.id);
  const commit = useCallback((next: EditorPage[], reload = false) => {
    const h = history.current;
    h.past = [...h.past.slice(-19), h.present];
    h.present = next;
    h.future = [];
    setPages(next);
    setHistoryCounts({ past: h.past.length, future: 0 });
    setDirty(true);
    if (reload) setRevision((v) => v + 1);
  }, []);
  const onChange = useCallback(
    (id: string, overlay: OverlayJSON) => {
      const present = history.current.present;
      const page = present.find((p) => p.id === id);
      if (!page || JSON.stringify(page.overlay) === JSON.stringify(overlay)) return;
      commit(present.map((p) => (p.id === id ? { ...p, overlay } : p)));
    },
    [commit],
  );
  const onReady = useCallback((instance: Canvas | null) => {
    canvas.current = instance;
    setReady(Boolean(instance));
    setSelected(null);
    if (instance) {
      const changed = () => setSelected(instance.getActiveObject() ?? null);
      instance.on("selection:created", changed);
      instance.on("selection:updated", changed);
      instance.on("selection:cleared", changed);
      instance.on("object:modified", () => refreshProperties((v) => v + 1));
    }
  }, []);
  const selectTool = useCallback(() => setTool("select"), []);
  const showError = useCallback((value: string) => setError(value), []);
  const load = useCallback(async (files: File[], restored?: EditorPage[]) => {
    setLoading(true);
    setError("");
    try {
      const file = files[0];
      const bytes = await file.arrayBuffer();
      const pdf = await openPdf(bytes);
      if (pdf.numPages > 500) {
        await pdf.loadingTask.destroy();
        throw new Error("Use a document with up to 500 pages.");
      }
      const initialPages: EditorPage[] = [];
      for (let i = 0; i < pdf.numPages; i++) {
        const page = await pdf.getPage(i + 1);
        const viewport = page.getViewport({ scale: 1 });
        if (viewport.width * viewport.height > 20_000_000) {
          await pdf.loadingTask.destroy();
          throw new Error("This PDF contains a page too large for the editor.");
        }
        initialPages.push({
          id: crypto.randomUUID(),
          sourcePage: i,
          rotation: 0,
          overlay: { objects: [] },
          width: viewport.width,
          height: viewport.height,
        });
      }
      if (restored) {
        if (
          !restored.length ||
          restored.length > 500 ||
          restored.some(
            (p) =>
              !Number.isFinite(p.width) ||
              !Number.isFinite(p.height) ||
              p.width <= 0 ||
              p.height <= 0 ||
              p.width * p.height > 20_000_000 ||
              (p.sourcePage !== null &&
                (!Number.isInteger(p.sourcePage) ||
                  p.sourcePage < 0 ||
                  p.sourcePage >= pdf.numPages)) ||
              !Array.isArray(p.overlay.objects) ||
              p.overlay.objects.length > 200,
          )
        ) {
          await pdf.loadingTask.destroy();
          throw new Error("Invalid saved draft.");
        }
        initialPages.splice(0, initialPages.length, ...restored);
      }
      await documentRef.current?.loadingTask.destroy();
      documentRef.current = pdf;
      original.current = bytes;
      setDraftBytes(bytes);
      history.current = { past: [], present: initialPages, future: [] };
      setHistoryCounts({ past: 0, future: 0 });
      setDoc(pdf);
      setPages(initialPages);
      setName(file.name);
      setActiveId(initialPages[0].id);
      setDirty(false);
      setOutput(null);
      setZoom(
        Math.max(
          0.3,
          Math.min(
            1,
            (window.innerWidth - (window.innerWidth > 1000 ? 740 : 100)) / initialPages[0].width,
          ),
        ),
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const pending = takePendingFiles();
    if (pending.length)
      queueMicrotask(() => {
        void load(pending);
      });
  }, [load]);
  useEffect(
    () => () => {
      controller.current?.abort();
      void documentRef.current?.loadingTask.destroy();
    },
    [],
  );
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const link = (e: MouseEvent) => {
      const target = (e.target as Element).closest("a[href]");
      if (
        target &&
        !target.hasAttribute("download") &&
        !window.confirm("You have unsaved changes. Leave anyway?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", link, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", link, true);
    };
  }, [dirty]);
  function saveCanvas() {
    if (!canvas.current || !active) return;
    onChange(active.id, canvas.current.toJSON() as OverlayJSON);
    refreshProperties((v) => v + 1);
  }
  function addObject(object: FabricObject) {
    if (!canvas.current) return;
    if (canvas.current.getObjects().length >= 200) {
      setError("Keep each page below 200 annotation objects.");
      return;
    }
    canvas.current.add(object);
    canvas.current.setActiveObject(object);
    canvas.current.requestRenderAll();
    setTool("select");
    saveCanvas();
  }
  function shape(kind: string) {
    const base = {
      ...topLeft,
      left: 55,
      top: 65,
      fill: "transparent",
      stroke: color,
      strokeWidth: brushWidth,
    };
    if (kind === "rectangle")
      addObject(new Rect({ ...topLeft, ...base, width: 180, height: 95, rx: 3, ry: 3 }));
    if (kind === "ellipse") addObject(new Ellipse({ ...base, rx: 85, ry: 45 }));
    if (kind === "line") addObject(new Line([0, 0, 200, 0], { ...base }));
    if (kind === "arrow")
      addObject(
        new Path("M 0 30 L 180 30 M 150 5 L 180 30 L 150 55", {
          ...base,
          fill: "",
          strokeLineCap: "round",
          strokeLineJoin: "round",
        }),
      );
    if (kind === "highlight")
      addObject(
        new Rect({
          ...topLeft,
          left: 50,
          top: 90,
          width: 230,
          height: 25,
          fill: "#ffe066",
          opacity: 0.4,
          strokeWidth: 0,
        }),
      );
    if (kind === "mask")
      addObject(
        new Rect({
          ...topLeft,
          left: 50,
          top: 90,
          width: 230,
          height: 30,
          fill: "#ffffff",
          strokeWidth: 0,
        }),
      );
    if (kind === "stamp")
      addObject(
        new Textbox("APPROVED", {
          ...topLeft,
          left: 75,
          top: 120,
          width: 210,
          fontFamily: "Arial",
          fontSize: 28,
          fontWeight: "bold",
          fill: "#167967",
          angle: -12,
          charSpacing: 100,
        }),
      );
  }
  async function addImage(url: string) {
    const instance = canvas.current;
    if (!instance) return;
    const image = await FabricImage.fromURL(url);
    if (canvas.current !== instance) return;
    image.scaleToWidth(Math.min(220, active.width / 2));
    image.set({ ...topLeft, left: 70, top: 90 });
    addObject(image);
  }
  async function uploadImage(file: File) {
    setError("");
    try {
      validateFile(
        file.name,
        file.type,
        file.size,
        new Uint8Array(await file.slice(0, 12).arrayBuffer()),
        5 * 1024 * 1024,
      );
      const bitmap = await createImageBitmap(file);
      try {
        if (bitmap.width * bitmap.height > 40_000_000)
          throw new Error("Use an image under 40 million pixels.");
        const node = document.createElement("canvas");
        const factor = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
        node.width = Math.max(1, Math.round(bitmap.width * factor));
        node.height = Math.max(1, Math.round(bitmap.height * factor));
        node.getContext("2d")!.drawImage(bitmap, 0, 0, node.width, node.height);
        const blob = await canvasBlob(node, "image/png", 1);
        const reader = new FileReader();
        const url = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        await addImage(url);
        node.width = 0;
      } finally {
        bitmap.close();
      }
    } catch (e) {
      setError(message(e));
    }
  }
  function update(values: Record<string, unknown>) {
    const object = canvas.current?.getActiveObject();
    if (!object || !canvas.current) return;
    object.set(values);
    object.setCoords();
    canvas.current.requestRenderAll();
    saveCanvas();
  }
  async function duplicateObject() {
    const selected = canvas.current?.getActiveObject();
    if (!selected) return;
    const copy = await selected.clone();
    copy.set({ left: selected.left + 15, top: selected.top + 15 });
    addObject(copy);
  }
  function deleteObject() {
    const instance = canvas.current;
    if (!instance) return;
    const objects = instance.getActiveObjects();
    instance.discardActiveObject();
    instance.remove(...objects);
    instance.requestRenderAll();
    setSelected(null);
    saveCanvas();
  }
  function layer(forward: boolean) {
    const instance = canvas.current;
    const object = instance?.getActiveObject();
    if (!instance || !object) return;
    if (forward) instance.bringObjectForward(object);
    else instance.sendObjectBackwards(object);
    instance.requestRenderAll();
    saveCanvas();
  }
  function undo() {
    const h = history.current;
    const previous = h.past.pop();
    if (!previous) return;
    h.future.unshift(h.present);
    h.present = previous;
    setPages(previous);
    if (!previous.some((p) => p.id === activeId)) setActiveId(previous[0].id);
    setRevision((v) => v + 1);
    setHistoryCounts({ past: h.past.length, future: h.future.length });
    setDirty(true);
  }
  function redo() {
    const h = history.current;
    const next = h.future.shift();
    if (!next) return;
    h.past.push(h.present);
    h.present = next;
    setPages(next);
    if (!next.some((p) => p.id === activeId)) setActiveId(next[0].id);
    setRevision((v) => v + 1);
    setHistoryCounts({ past: h.past.length, future: h.future.length });
    setDirty(true);
  }
  function pageAction(action: string) {
    if (!active || !canvas.current) return;
    const current = history.current.present.map((p) =>
      p.id === active.id ? { ...p, overlay: canvas.current!.toJSON() as OverlayJSON } : p,
    );
    if (action === "blank") {
      const blank: EditorPage = {
        id: crypto.randomUUID(),
        sourcePage: null,
        rotation: 0,
        overlay: { objects: [] },
        width: 595.28,
        height: 841.89,
      };
      commit([...current, blank], true);
      setActiveId(blank.id);
    }
    if (action === "duplicate") {
      const copy = { ...structuredClone(current[activeIndex]), id: crypto.randomUUID() };
      commit([...current.slice(0, activeIndex + 1), copy, ...current.slice(activeIndex + 1)], true);
      setActiveId(copy.id);
    }
    if (action === "delete" && current.length > 1) {
      const next = current.filter((p) => p.id !== active.id);
      commit(next, true);
      setActiveId(next[Math.min(activeIndex, next.length - 1)].id);
    }
    if (action === "up" || action === "down") {
      const target = activeIndex + (action === "up" ? -1 : 1);
      if (target < 0 || target >= current.length) return;
      [current[activeIndex], current[target]] = [current[target], current[activeIndex]];
      commit(current, false);
    }
    if (action === "rotate") {
      const instance = canvas.current;
      instance.discardActiveObject();
      instance.getObjects().forEach((object) => {
        const center = object.getCenterPoint();
        object.rotate(object.angle + 90);
        object.setPositionByOrigin(
          new Point(active.height - center.y, center.x),
          "center",
          "center",
        );
        object.setCoords();
      });
      const overlay = instance.toJSON() as OverlayJSON;
      commit(
        current.map((p) =>
          p.id === active.id
            ? { ...p, width: p.height, height: p.width, rotation: (p.rotation + 90) % 360, overlay }
            : p,
        ),
        true,
      );
    }
  }
  async function exportPdf() {
    if (!original.current || !active) return;
    const snapshot = history.current.present.map((p) =>
      p.id === active.id && canvas.current
        ? { ...p, overlay: canvas.current.toJSON() as OverlayJSON }
        : p,
    );
    history.current.present = snapshot;
    setPages(snapshot);
    setBusy(true);
    setProgress(0);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    const finishHistory = beginHistory(name);
    let outcome: "COMPLETED" | "FAILED" | "CANCELLED" = "COMPLETED";
    try {
      const overlays = await renderEditorOverlays(snapshot, setProgress, abort.signal);
      const result = await assembleEditedPdf(
        original.current,
        overlays,
        `${name.replace(/\.pdf$/i, "")}-edited.pdf`,
        setProgress,
        abort.signal,
      );
      setOutput({ ...result, historyRecorded: true });
      setDirty(false);
    } catch (e) {
      outcome = abort.signal.aborted ? "CANCELLED" : "FAILED";
      setError(
        abort.signal.aborted ? "Export cancelled. Your edits are still available." : message(e),
      );
    } finally {
      finishHistory(abort.signal.aborted ? "CANCELLED" : outcome);
      setBusy(false);
      controller.current = null;
    }
  }
  function reset() {
    if (dirty && !window.confirm("You have unsaved changes. Discard them?")) return;
    void documentRef.current?.loadingTask.destroy();
    documentRef.current = null;
    original.current = null;
    setDraftBytes(null);
    setDoc(null);
    setPages([]);
    setOutput(null);
    setDirty(false);
    setError("");
    history.current = { past: [], present: [], future: [] };
    setHistoryCounts({ past: 0, future: 0 });
  }
  if (output)
    return (
      <div className="mt-6">
        <Result output={output} onReset={reset} />
        <Button variant="secondary" className="mt-4" onClick={() => setOutput(null)}>
          Back to editor
        </Button>
      </div>
    );
  if (busy)
    return (
      <div className="panel result-panel mt-6">
        <LoaderCircle size={35} className="spin text-[var(--primary)]" />
        <h2>Exporting your edits</h2>
        <div
          className="progress-track max-w-md"
          role="progressbar"
          aria-label="Editor export progress"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div style={{ width: `${progress}%` }} />
        </div>
        <p>{progress}% · Your original stays unchanged.</p>
        <Button variant="secondary" onClick={() => controller.current?.abort()}>
          Cancel export
        </Button>
      </div>
    );
  return (
    <div className="mt-6">
      <EditorDraft
        name={name}
        bytes={draftBytes}
        pages={pages}
        onRestore={async (draft) => {
          await load(
            [new File([draft.bytes], draft.name, { type: "application/pdf" })],
            draft.pages,
          );
          setDraftBytes(draft.bytes);
          setRevision((v) => v + 1);
        }}
      />
      {error && (
        <div className="error mb-4" role="alert">
          {error}
          <button className="float-right" aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={14} />
          </button>
        </div>
      )}
      {!doc ? (
        <>
          <div className="notice mb-5">
            <ShieldCheck size={17} />
            <span>
              A private, on-device PDF editor. Edits export as flattened visual overlays with an
              approximate searchable layer for added Latin text. Existing text replacement is visual
              masking, not permanent removal.
            </span>
          </div>
          <Dropzone onFiles={load} disabled={loading} />
          {loading && <p className="muted text-xs my-4">Preparing your editor…</p>}
        </>
      ) : (
        active && (
          <>
            <div className="flex justify-between items-center gap-3 mb-4">
              <p className="text-xs truncate">
                <strong>{name}</strong>
                <span className="muted"> · {dirty ? "Unsaved changes" : "Original preserved"}</span>
              </p>
              <Button size="sm" variant="secondary" onClick={reset}>
                Open another PDF
              </Button>
            </div>
            <div className="editor-shell">
              <div className="editor-toolbar" role="toolbar" aria-label="PDF editing tools">
                <Button
                  size="sm"
                  variant={tool === "select" ? "default" : "ghost"}
                  disabled={!ready}
                  onClick={() => setTool("select")}
                >
                  <MousePointer2 size={15} />
                  Select
                </Button>
                <Button
                  size="sm"
                  variant={tool === "text" ? "default" : "ghost"}
                  disabled={!ready}
                  onClick={() => setTool("text")}
                >
                  <Type size={15} />
                  Text
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!ready}
                  onClick={() => fileInput.current?.click()}
                >
                  <ImagePlus size={15} />
                  Image
                </Button>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  className="sr-only"
                  aria-label="Insert image"
                  ref={fileInput}
                  onChange={(e) => {
                    if (e.target.files?.[0]) void uploadImage(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={!ready}
                  aria-label="Rectangle"
                  onClick={() => shape("rectangle")}
                >
                  <Square size={16} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={!ready}
                  aria-label="Ellipse"
                  onClick={() => shape("ellipse")}
                >
                  <Circle size={16} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={!ready}
                  aria-label="Line"
                  onClick={() => shape("line")}
                >
                  <Minus size={16} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={!ready}
                  aria-label="Arrow"
                  onClick={() => shape("arrow")}
                >
                  <ArrowUpRight size={16} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!ready}
                  onClick={() => shape("highlight")}
                >
                  <Highlighter size={15} />
                  Highlight
                </Button>
                <Button
                  size="sm"
                  variant={tool === "draw" ? "default" : "ghost"}
                  disabled={!ready}
                  onClick={() => setTool(tool === "draw" ? "select" : "draw")}
                >
                  <Pencil size={15} />
                  Draw
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!ready}
                  onClick={() => setSignOpen(true)}
                >
                  <Signature size={15} />
                  Sign
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={!ready}
                  aria-label="Approved stamp"
                  onClick={() => shape("stamp")}
                >
                  <Stamp size={16} />
                </Button>
                <Button size="sm" variant="ghost" disabled={!ready} onClick={() => shape("mask")}>
                  <Eraser size={15} />
                  Whiteout
                </Button>
                <Button
                  size="sm"
                  variant={tool === "existing" ? "default" : "ghost"}
                  disabled={!ready}
                  onClick={() => setTool(tool === "existing" ? "select" : "existing")}
                >
                  <ScanText size={15} />
                  Existing text
                </Button>
                <div className="editor-toolbar-end">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Undo edit"
                    disabled={!historyCounts.past || !ready}
                    onClick={undo}
                  >
                    <Undo2 size={16} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Redo edit"
                    disabled={!historyCounts.future || !ready}
                    onClick={redo}
                  >
                    <Redo2 size={16} />
                  </Button>
                  <Button size="sm" disabled={!ready} onClick={() => void exportPdf()}>
                    <Download size={15} />
                    Export PDF
                  </Button>
                </div>
              </div>
              <div className="editor-subtoolbar">
                <span>
                  {tool === "text"
                    ? "Click the page to add text"
                    : tool === "draw"
                      ? "Draw on the page"
                      : tool === "existing"
                        ? "Select detected text to create a replacement overlay"
                        : "Select an object to move, resize or rotate it"}
                </span>
                <label className="inline-flex items-center gap-2">
                  Color
                  <input
                    aria-label="Drawing color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                  />
                </label>
                <label className="inline-flex items-center gap-2">
                  Stroke
                  <input
                    aria-label="Drawing stroke width"
                    type="number"
                    min={1}
                    max={30}
                    value={brushWidth}
                    onChange={(e) =>
                      setBrushWidth(Math.min(30, Math.max(1, Number(e.target.value))))
                    }
                  />
                </label>
              </div>
              <div className="editor-body">
                <aside className="editor-pages">
                  <div className="editor-page-actions">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Add blank editor page"
                      disabled={!ready || pages.length >= 500}
                      onClick={() => pageAction("blank")}
                    >
                      <FilePlus2 size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Duplicate editor page"
                      disabled={!ready || pages.length >= 500}
                      onClick={() => pageAction("duplicate")}
                    >
                      <Copy size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Delete editor page"
                      disabled={!ready || pages.length < 2}
                      onClick={() => pageAction("delete")}
                    >
                      <Trash2 size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Rotate editor page"
                      disabled={!ready}
                      onClick={() => pageAction("rotate")}
                    >
                      <RotateCw size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Move editor page earlier"
                      disabled={!ready || activeIndex === 0}
                      onClick={() => pageAction("up")}
                    >
                      <ArrowUp size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Move editor page later"
                      disabled={!ready || activeIndex === pages.length - 1}
                      onClick={() => pageAction("down")}
                    >
                      <ArrowDown size={14} />
                    </Button>
                  </div>
                  {pages.map((page, index) => (
                    <button
                      className={`editor-page-button ${page.id === active.id ? "active" : ""}`}
                      key={page.id}
                      disabled={!ready}
                      aria-label={`Edit page ${index + 1}`}
                      onClick={() => {
                        saveCanvas();
                        setActiveId(page.id);
                        setTool("select");
                      }}
                    >
                      {page.sourcePage === null ? (
                        <div className="blank-thumb">Blank page</div>
                      ) : (
                        <PageCanvas
                          doc={doc}
                          pageNumber={page.sourcePage + 1}
                          rotation={page.rotation}
                        />
                      )}
                      <span>
                        {index + 1}
                        {page.overlay.objects.length > 0 ? " · edited" : ""}
                      </span>
                    </button>
                  ))}
                </aside>
                <div className="editor-work-area" ref={area}>
                  {tool === "existing" && (
                    <div className="notice mb-3">
                      Overlay editing: masks preserve appearance but leave original text underneath.
                      This is not redaction. Complex layouts and fonts may need manual adjustment.
                    </div>
                  )}
                  <EditorCanvas
                    key={`${active.id}-${revision}`}
                    doc={doc}
                    page={active}
                    zoom={zoom}
                    tool={tool}
                    color={color}
                    brushWidth={brushWidth}
                    onReady={onReady}
                    onChange={onChange}
                    onSelectTool={selectTool}
                    onError={showError}
                  />
                </div>
                <EditorProperties
                  object={selected}
                  onUpdate={update}
                  onDuplicate={() => void duplicateObject()}
                  onDelete={deleteObject}
                  onLayer={layer}
                />
              </div>
              <div className="editor-status">
                <span>
                  Page {activeIndex + 1} of {pages.length} · {active.overlay.objects.length} objects
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Editor zoom out"
                    onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
                  >
                    <ZoomOut size={14} />
                  </Button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Editor zoom in"
                    onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
                  >
                    <ZoomIn size={14} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Fit editor page"
                    onClick={() =>
                      setZoom(
                        Math.max(
                          0.2,
                          Math.min(1.5, ((area.current?.clientWidth ?? 650) - 48) / active.width),
                        ),
                      )
                    }
                  >
                    <Maximize size={14} />
                  </Button>
                </div>
                <span>On-device · Original unchanged</span>
              </div>
            </div>
            <SignatureDialog open={signOpen} onOpenChange={setSignOpen} onAdd={addImage} />
          </>
        )
      )}
    </div>
  );
}
