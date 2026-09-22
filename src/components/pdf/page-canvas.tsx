"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
export function PageCanvas({
  doc,
  pageNumber,
  scale = 0.2,
  rotation = 0,
  className = "",
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale?: number;
  rotation?: number;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const node = holder.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    async function render() {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled || !canvas.current) return;
        const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
        const node = canvas.current;
        node.width = viewport.width;
        node.height = viewport.height;
        task = page.render({ canvas: node, viewport });
        await task.promise;
      } catch (e) {
        if (!cancelled && !(e instanceof Error && e.name === "RenderingCancelledException"))
          setError(true);
      }
    }
    void render();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, scale, rotation, visible]);
  return (
    <div className={className} ref={holder}>
      {error ? (
        <small>Preview unavailable</small>
      ) : (
        <canvas ref={canvas} aria-label={`Preview of page ${pageNumber}`} />
      )}
    </div>
  );
}
