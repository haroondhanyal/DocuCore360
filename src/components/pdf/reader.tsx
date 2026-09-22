"use client";
import { PasswordInput } from "@/components/ui/password-input";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Fullscreen,
  Info,
  List,
  LoaderCircle,
  Maximize,
  Minimize,
  Printer,
  RotateCw,
  Search,
  X,
  ZoomIn,
  ZoomOut,
  Presentation,
} from "lucide-react";
import { Dropzone } from "@/components/upload/dropzone";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PageCanvas } from "@/components/pdf/page-canvas";
import { ReaderPage } from "@/components/pdf/reader-page";
import { downloadBytes, openPdf } from "@/lib/pdf/browser";
import { takePendingFiles } from "@/lib/pending-file";
import { formatBytes, message } from "@/lib/utils";
type OutlineItem = { title: string; dest: string | unknown[] | null; items: OutlineItem[] };
export function PdfReader() {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordNeeded, setPasswordNeeded] = useState(false);
  const [password, setPassword] = useState("");
  const [current, setCurrent] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [mode, setMode] = useState("continuous");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<{ page: number; offset: number }[]>([]);
  const [hit, setHit] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const reader = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const initial = useRef(false);
  const loadVersion = useRef(0);
  const pageTexts = useRef<string[]>([]);
  const load = useCallback(async (input: File, passwordValue?: string) => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");
    try {
      const buffer = await input.arrayBuffer();
      setFile(input);
      setBytes(buffer);
      const opened = await openPdf(buffer, passwordValue);
      if (version !== loadVersion.current) {
        await opened.loadingTask.destroy();
        return;
      }
      if (opened.numPages < 1 || opened.numPages > 500) {
        await opened.loadingTask.destroy();
        throw new Error("The reader supports PDFs with 1–500 pages.");
      }
      if (docRef.current) await docRef.current.loadingTask.destroy();
      docRef.current = opened;
      setDoc(opened);
      setCurrent(1);
      setPageInput("1");
      setRotation(0);
      setSearch("");
      pageTexts.current = [];
      setPasswordNeeded(false);
      setPassword("");
      const meta = await opened.getMetadata();
      const raw = meta.info as Record<string, unknown>;
      setMetadata(
        Object.fromEntries(
          [
            "Title",
            "Author",
            "Subject",
            "Creator",
            "Producer",
            "PDFFormatVersion",
            "CreationDate",
          ].map((key) => [key, typeof raw[key] === "string" ? (raw[key] as string) : "—"]),
        ),
      );
      setOutline(((await opened.getOutline()) ?? []) as OutlineItem[]);
      const first = await opened.getPage(1);
      const available = viewport.current?.clientWidth ?? Math.max(300, window.innerWidth - 560);
      setScale(
        Math.min(1.3, Math.max(0.25, (available - 50) / first.getViewport({ scale: 1 }).width)),
      );
    } catch (e) {
      if (e instanceof Error && /password/i.test(e.message)) {
        setPasswordNeeded(true);
        setError(
          passwordValue
            ? "That password was not accepted. Please try again."
            : "This document requires a password.",
        );
      } else setError(message(e));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (initial.current) return;
    initial.current = true;
    const files = takePendingFiles();
    if (files[0])
      queueMicrotask(() => {
        void load(files[0]);
      });
  }, [load]);
  useEffect(
    () => () => {
      ++loadVersion.current;
      void docRef.current?.loadingTask.destroy();
    },
    [],
  );
  const go = useCallback(
    (page: number) => {
      if (!doc) return;
      const n = Math.max(1, Math.min(doc.numPages, page));
      setCurrent(n);
      setPageInput(String(n));
      if (mode === "continuous")
        requestAnimationFrame(() =>
          document
            .getElementById(`pdf-page-${n}`)
            ?.scrollIntoView({ block: "start", behavior: "instant" }),
        );
    },
    [doc, mode],
  );
  const onActive = useCallback((page: number) => {
    setCurrent(page);
    setPageInput(String(page));
  }, []);
  const print = useCallback(() => {
    if (!bytes) return;
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.width = "1px";
    frame.style.height = "1px";
    frame.style.opacity = "0";
    frame.setAttribute("title", "Print PDF");
    frame.src = url;
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        setError("Use Download, then print the PDF from your browser's PDF viewer.");
      }
    };
    document.body.appendChild(frame);
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 120_000);
  }, [bytes]);
  useEffect(() => {
    if (!doc) return;
    function key(e: KeyboardEvent) {
      const editing =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInput.current?.focus(), 0);
      } else if ((e.ctrlKey || e.metaKey) && ["+", "=", "-"].includes(e.key)) {
        e.preventDefault();
        setScale((v) => Math.min(3, Math.max(0.25, v + (e.key === "-" ? -0.1 : 0.1))));
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        print();
      } else if (e.key === "Escape") {
        setSearchOpen(false);
      } else if (!editing && ["ArrowRight", "ArrowLeft"].includes(e.key)) {
        e.preventDefault();
        go(current + (e.key === "ArrowRight" ? 1 : -1));
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [doc, current, go, print]);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!doc || !search.trim()) {
        setHits([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const found: { page: number; offset: number }[] = [];
        const query = search.trim().toLowerCase();
        for (let p = 1; p <= doc.numPages; p++) {
          if (cancelled) return;
          if (pageTexts.current[p] === undefined) {
            const page = await doc.getPage(p);
            const content = await page.getTextContent();
            pageTexts.current[p] = content.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" ")
              .toLowerCase();
          }
          const text = pageTexts.current[p];
          let start = 0;
          let at;
          while ((at = text.indexOf(query, start)) !== -1) {
            found.push({ page: p, offset: at });
            start = at + query.length;
            if (found.length >= 10_000) break;
          }
        }
        if (!cancelled) {
          setHits(found);
          setHit(0);
        }
      } catch {
        if (!cancelled) setError("Text search could not read this document.");
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, doc]);
  async function fit(widthOnly: boolean) {
    if (!doc || !viewport.current) return;
    const page = await doc.getPage(current);
    const size = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 });
    const w =
      (viewport.current.clientWidth - 50) / (mode === "two" ? size.width * 2 + 16 : size.width);
    const h = (viewport.current.clientHeight - 50) / size.height;
    setScale(Math.max(0.1, Math.min(3, widthOnly ? w : Math.min(w, h))));
  }
  async function fullscreen(presentation = false) {
    try {
      if (presentation) setMode("single");
      if (document.fullscreenElement) await document.exitFullscreen();
      else await reader.current?.requestFullscreen();
    } catch {
      setError("Fullscreen is unavailable in this browser.");
    }
  }
  function nextHit(delta: number) {
    if (!hits.length) return;
    const n = (hit + delta + hits.length) % hits.length;
    setHit(n);
    go(hits[n].page);
  }
  async function openDestination(dest: OutlineItem["dest"]) {
    if (!doc || !dest) return;
    try {
      const target = typeof dest === "string" ? await doc.getDestination(dest) : dest;
      if (!target) return;
      const first = target[0];
      const index =
        typeof first === "number"
          ? first
          : await doc.getPageIndex(first as { num: number; gen: number });
      go(index + 1);
    } catch {
      setError("This bookmark destination is unavailable.");
    }
  }
  function outlineItems(items: OutlineItem[], level = 0): React.ReactNode {
    return items.map((item, index) => (
      <div key={`${level}-${index}`} style={{ paddingLeft: level * 10 }}>
        <button onClick={() => void openDestination(item.dest)}>{item.title}</button>
        {outlineItems(item.items ?? [], level + 1)}
      </div>
    ));
  }
  const visiblePages = doc
    ? mode === "continuous"
      ? Array.from({ length: doc.numPages }, (_, i) => i + 1)
      : mode === "two"
        ? [current, current + 1].filter((p) => p <= doc.numPages)
        : [current]
    : [];
  return (
    <div className="mt-7">
      {error && (
        <p className="error mb-4" role="alert">
          {error}
        </p>
      )}
      {passwordNeeded && file && (
        <form
          className="panel flex gap-3 mb-5 flex-wrap"
          onSubmit={(e) => {
            e.preventDefault();
            void load(file, password);
          }}
        >
          <label className="field flex-1">
            PDF password
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <Button type="submit" disabled={loading}>
            Open PDF
          </Button>
        </form>
      )}
      {!doc && <Dropzone onFiles={(files) => load(files[0])} disabled={loading} />}
      {loading && (
        <p className="flex items-center gap-2 muted text-xs my-5">
          <LoaderCircle size={16} className="spin" />
          Opening your document…
        </p>
      )}
      {doc && (
        <>
          <div className="flex justify-between items-center mb-4 gap-4">
            <p className="text-xs truncate">
              <strong>{file?.name}</strong> <span className="muted">· {doc.numPages} pages</span>
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                ++loadVersion.current;
                void doc.loadingTask.destroy();
                docRef.current = null;
                setDoc(null);
                setFile(null);
                setBytes(null);
                setError("");
                setPasswordNeeded(false);
              }}
            >
              Open another PDF
            </Button>
          </div>
          <div className="reader" ref={reader}>
            <div className="reader-toolbar">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Previous page"
                disabled={current === 1}
                onClick={() => go(current - 1)}
              >
                <ChevronLeft size={17} />
              </Button>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = Number(pageInput);
                  if (Number.isInteger(n) && n > 0) go(n);
                  else setPageInput(String(current));
                }}
              >
                <input
                  type="number"
                  aria-label="Page number"
                  min={1}
                  max={doc.numPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                />
              </form>
              <span className="text-xs muted">/ {doc.numPages}</span>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Next page"
                disabled={current === doc.numPages}
                onClick={() => go(current + 1)}
              >
                <ChevronRight size={17} />
              </Button>
              <span className="h-5 w-px bg-[var(--line)] mx-1" />
              <Button
                size="icon"
                variant="ghost"
                aria-label="Zoom out"
                onClick={() => setScale((s) => Math.max(0.25, s - 0.1))}
              >
                <ZoomOut size={16} />
              </Button>
              <span className="text-xs w-10 text-center">{Math.round(scale * 100)}%</span>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Zoom in"
                onClick={() => setScale((s) => Math.min(3, s + 0.1))}
              >
                <ZoomIn size={16} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Fit width"
                onClick={() => void fit(true)}
              >
                <Maximize size={16} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Fit page"
                onClick={() => void fit(false)}
              >
                <Minimize size={16} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setScale(1)}>
                100%
              </Button>
              <select
                aria-label="Page view mode"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="continuous">Continuous</option>
                <option value="single">Single page</option>
                <option value="two">Two pages</option>
              </select>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Search document"
                onClick={() => {
                  setSearchOpen((v) => !v);
                  setTimeout(() => searchInput.current?.focus(), 0);
                }}
              >
                <Search size={16} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Rotate view"
                onClick={() => setRotation((r) => (r + 90) % 360)}
              >
                <RotateCw size={16} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Bookmarks"
                onClick={() => setOutlineOpen((v) => !v)}
              >
                <List size={16} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Document information"
                onClick={() => setInfoOpen(true)}
              >
                <Info size={16} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Full screen"
                onClick={() => void fullscreen()}
              >
                <Fullscreen size={16} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Presentation mode"
                onClick={() => void fullscreen(true)}
              >
                <Presentation size={16} />
              </Button>
              <Button size="icon" variant="ghost" aria-label="Print PDF" onClick={print}>
                <Printer size={16} />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                aria-label="Download PDF"
                onClick={() =>
                  bytes &&
                  downloadBytes(
                    new Uint8Array(bytes),
                    file?.name ?? "document.pdf",
                    "application/pdf",
                  )
                }
              >
                <Download size={16} />
              </Button>
            </div>
            {searchOpen && (
              <div className="reader-search">
                <Search size={15} />
                <input
                  ref={searchInput}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find in document…"
                  aria-label="Find in document"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") nextHit(e.shiftKey ? -1 : 1);
                  }}
                />
                <span className="text-xs muted">
                  {searching
                    ? "Searching…"
                    : hits.length
                      ? `${hit + 1} of ${hits.length} · page ${hits[hit]?.page}`
                      : search
                        ? "No matches"
                        : "Search selectable text"}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Previous match"
                  disabled={!hits.length}
                  onClick={() => nextHit(-1)}
                >
                  <ChevronLeft size={15} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Next match"
                  disabled={!hits.length}
                  onClick={() => nextHit(1)}
                >
                  <ChevronRight size={15} />
                </Button>
                {hits.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => go(hits[hit].page)}>
                    Go to match
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Close search"
                  onClick={() => setSearchOpen(false)}
                >
                  <X size={15} />
                </Button>
              </div>
            )}
            {outlineOpen && (
              <div className="reader-outline">
                {outline.length ? (
                  outlineItems(outline)
                ) : (
                  <p className="muted text-xs">This PDF has no bookmarks.</p>
                )}
              </div>
            )}
            <div className="reader-body">
              <aside className="reader-thumbs" aria-label="Page thumbnails">
                {Array.from({ length: doc.numPages }, (_, i) => (
                  <button
                    key={i}
                    className={current === i + 1 ? "active" : ""}
                    onClick={() => go(i + 1)}
                    aria-label={`Go to page ${i + 1}`}
                  >
                    <PageCanvas doc={doc} pageNumber={i + 1} />
                    {i + 1}
                  </button>
                ))}
              </aside>
              <div className={`reader-pages ${mode === "two" ? "two-page" : ""}`} ref={viewport}>
                <div className="pages-inner">
                  {visiblePages.map((number) => (
                    <ReaderPage
                      key={`${doc.fingerprints[0]}-${number}`}
                      doc={doc}
                      number={number}
                      scale={scale}
                      rotation={rotation}
                      search={searchOpen ? search : ""}
                      onActive={mode === "continuous" ? onActive : () => {}}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="reader-status">
              <span>{file && formatBytes(file.size)} · Original document unchanged</span>
              <span>On-device viewing · Ctrl/Cmd + F to search</span>
            </div>
          </div>
        </>
      )}
      <Dialog open={infoOpen} onOpenChange={setInfoOpen} title="Document information">
        <dl className="space-y-3 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="muted">Pages</dt>
            <dd>{doc?.numPages}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="muted">File size</dt>
            <dd>{file ? formatBytes(file.size) : "—"}</dd>
          </div>
          {Object.entries(metadata).map(([k, v]) => (
            <div className="flex justify-between gap-5" key={k}>
              <dt className="muted">{k}</dt>
              <dd className="text-right break-all max-w-64">{v}</dd>
            </div>
          ))}
        </dl>
      </Dialog>
    </div>
  );
}
