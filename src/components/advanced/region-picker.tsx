"use client";
import { useEffect, useRef, useState } from "react";
import { openPdf } from "@/lib/pdf/browser";
import { Button } from "@/components/ui/button";
import { message } from "@/lib/utils";
export type Region = { page: number; x: number; y: number; width: number; height: number };
export function RegionPicker({
  file,
  regions,
  onChange,
  disabled = false,
  mode = "redact",
}: {
  mode?: "redact" | "form";
  file: File;
  regions: Region[];
  onChange: (r: Region[]) => void;
  disabled?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(1);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState<Region | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let stopped = false;
    let destroy: (() => Promise<void>) | undefined;
    queueMicrotask(() => {
      setReady(false);
      setError("");
    });
    void (async () => {
      const pdf = await openPdf(await file.arrayBuffer());
      destroy = () => pdf.loadingTask.destroy();
      if (stopped) {
        await destroy();
        return;
      }
      setCount(pdf.numPages);
      const p = await pdf.getPage(Math.min(page, pdf.numPages));
      const base = p.getViewport({ scale: 1 });
      const viewport = p.getViewport({ scale: Math.min(1.4, 900 / base.width) });
      if (viewport.width * viewport.height > 40_000_000) throw new Error("Page is too large.");
      if (!canvas.current || stopped) return;
      canvas.current.width = viewport.width;
      canvas.current.height = viewport.height;
      await p.render({ canvas: canvas.current, viewport }).promise;
      if (!stopped) setReady(true);
    })().catch((e) => {
      if (!stopped) setError(message(e));
    });
    return () => {
      stopped = true;
      void destroy?.();
    };
  }, [file, page]);
  function point(e: React.PointerEvent) {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)),
    };
  }
  return (
    <section className="panel form-stack">
      <div className="flex gap-3 items-center">
        <h3>{mode === "form" ? "Place a form field" : "Mark redaction regions"}</h3>
        <label>
          Preview page
          <input
            aria-label="Preview page"
            className="field"
            type="number"
            min={1}
            max={count}
            value={page}
            onChange={(e) => setPage(Math.max(1, Math.min(count, Number(e.target.value))))}
          />
        </label>
        <span>of {count}</span>
      </div>
      <p>
        {mode === "form"
          ? "Drag a rectangle for the new field. The latest rectangle determines its position. Unrotated PDF pages are supported."
          : "Drag across sensitive content. Black rectangles show areas to remove from the exported document."}
      </p>
      <div
        style={{
          position: "relative",
          width: "fit-content",
          maxWidth: "100%",
          touchAction: "none",
          cursor: "crosshair",
        }}
        onPointerDown={(e) => {
          if (!ready || disabled || regions.length >= 100) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = point(e);
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const p = point(e),
            s = start.current;
          setDrag({
            page,
            x: Math.min(p.x, s.x),
            y: Math.min(p.y, s.y),
            width: Math.abs(p.x - s.x),
            height: Math.abs(p.y - s.y),
          });
        }}
        onPointerUp={(e) => {
          if (!start.current) return;
          const p = point(e),
            s = start.current;
          const r = {
            page,
            x: Math.min(p.x, s.x),
            y: Math.min(p.y, s.y),
            width: Math.abs(p.x - s.x),
            height: Math.abs(p.y - s.y),
          };
          if (r.width > 0.1 && r.height > 0.1) onChange(mode === "form" ? [r] : [...regions, r]);
          start.current = null;
          setDrag(null);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDrag(null);
        }}
      >
        <canvas
          ref={canvas}
          aria-label="Redaction page preview"
          data-ready={ready}
          style={{ display: "block", maxWidth: "100%", height: "auto" }}
        />
        {[...regions, ...(drag ? [drag] : [])]
          .filter((r) => r.page === page || r.page === 0)
          .map((r, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                pointerEvents: "none",
                left: `${r.x}%`,
                top: `${r.y}%`,
                width: `${r.width}%`,
                height: `${r.height}%`,
                background: mode === "form" ? "#167d67" : "#000",
                opacity: 0.8,
              }}
            />
          ))}
      </div>
      {regions.map((r, i) => (
        <div key={i} className="flex gap-3">
          <span>
            Region {i + 1} · page {r.page || "all"} · {r.width.toFixed(1)}% × {r.height.toFixed(1)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(regions.filter((_, n) => n !== i))}
          >
            Remove region {i + 1}
          </Button>
        </div>
      ))}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
