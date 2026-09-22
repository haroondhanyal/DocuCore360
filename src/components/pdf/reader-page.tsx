"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { pdfjs } from "@/lib/pdf/browser";
type TextSpan = {
  text: string;
  left: number;
  top: number;
  height: number;
  width: number;
  angle: number;
  family: string;
  scaleX: number;
};
export function ReaderPage({
  doc,
  number,
  scale,
  rotation,
  search,
  onActive,
}: {
  doc: PDFDocumentProxy;
  number: number;
  scale: number;
  rotation: number;
  search: string;
  onActive: (page: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [spans, setSpans] = useState<TextSpan[]>([]);
  const [size, setSize] = useState({ width: 595, height: 842 });
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void doc.getPage(number).then((page) => {
      if (!cancelled) {
        const viewport = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 });
        setSize({ width: viewport.width, height: viewport.height });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [doc, number, rotation]);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        setVisible(entries[0].isIntersecting);
      },
      { rootMargin: "500px" },
    );
    const active = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onActive(number);
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    active.observe(node);
    return () => {
      observer.disconnect();
      active.disconnect();
    };
  }, [number, onActive]);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    async function render() {
      try {
        const page = await doc.getPage(number);
        if (cancelled || !canvas.current) return;
        const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
        const node = canvas.current;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        node.width = Math.floor(viewport.width * ratio);
        node.height = Math.floor(viewport.height * ratio);
        node.style.width = `${viewport.width}px`;
        node.style.height = `${viewport.height}px`;
        task = page.render({ canvas: node, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
        await task.promise;
        if (cancelled) return;
        const content = await page.getTextContent();
        const { Util } = await pdfjs();
        const measure = document.createElement("canvas").getContext("2d");
        const next: TextSpan[] = [];
        for (const item of content.items) {
          if (!("str" in item) || !item.str) continue;
          const tx = Util.transform(viewport.transform, item.transform);
          const height = Math.hypot(tx[2], tx[3]);
          const family = content.styles[item.fontName]?.fontFamily ?? "sans-serif";
          if (measure) measure.font = `${height}px ${family}`;
          const measured = measure?.measureText(item.str).width ?? item.width * scale;
          next.push({
            text: item.str,
            left: tx[4],
            top: tx[5] - height * (content.styles[item.fontName]?.ascent ?? 0.8),
            height,
            width: item.width * scale,
            angle: Math.atan2(tx[1], tx[0]),
            family,
            scaleX: measured > 0 ? (item.width * scale) / measured : 1,
          });
        }
        if (!cancelled) setSpans(next);
      } catch (e) {
        if (!cancelled && !(e instanceof Error && e.name === "RenderingCancelledException"))
          setError("This page could not be rendered.");
      }
    }
    void render();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, number, scale, rotation, visible]);
  return (
    <div
      id={`pdf-page-${number}`}
      data-page={number}
      ref={ref}
      className="reader-page"
      style={{ width: size.width * scale, height: size.height * scale }}
      aria-label={`Page ${number}`}
    >
      {visible && (
        <>
          <canvas ref={canvas} />
          <div className="text-layer">
            {spans.map((span, i) => (
              <span
                key={i}
                className={
                  search.trim() && span.text.toLowerCase().includes(search.toLowerCase().trim())
                    ? "search-hit"
                    : ""
                }
                style={{
                  left: span.left,
                  top: span.top,
                  fontSize: span.height,
                  fontFamily: span.family,
                  transform: `rotate(${span.angle}rad) scaleX(${span.scaleX})`,
                }}
              >
                {span.text}
              </span>
            ))}
          </div>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
