"use client";
import { useEffect, useRef, useState } from "react";
import { Canvas, Textbox, Rect, PencilBrush } from "fabric";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { EditorPage, EditorTool, OverlayJSON } from "@/lib/pdf/editor-types";
import { pdfjs } from "@/lib/pdf/browser";
const topLeft = { originX: "left" as const, originY: "top" as const };
type Region = {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  angle: number;
};
export function EditorCanvas({
  doc,
  page,
  zoom,
  tool,
  color,
  brushWidth,
  onReady,
  onChange,
  onSelectTool,
  onError,
}: {
  doc: PDFDocumentProxy;
  page: EditorPage;
  zoom: number;
  tool: EditorTool;
  color: string;
  brushWidth: number;
  onReady: (canvas: Canvas | null) => void;
  onChange: (id: string, json: OverlayJSON) => void;
  onSelectTool: () => void;
  onError: (error: string) => void;
}) {
  const [initial] = useState(page);
  const overlayElement = useRef<HTMLCanvasElement>(null);
  const backgroundElement = useRef<HTMLCanvasElement>(null);
  const instance = useRef<Canvas | null>(null);
  const latest = useRef({ tool, color, brushWidth, zoom });
  const [regions, setRegions] = useState<Region[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    latest.current = { tool, color, brushWidth, zoom };
    const canvas = instance.current;
    if (!canvas) return;
    canvas.isDrawingMode = tool === "draw";
    canvas.selection = tool === "select";
    canvas.skipTargetFind = tool !== "select";
    canvas.defaultCursor = tool === "text" ? "crosshair" : "default";
    canvas.upperCanvasEl.style.pointerEvents = tool === "existing" ? "none" : "auto";
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = brushWidth;
    }
    canvas.setDimensions(
      { width: initial.width * zoom, height: initial.height * zoom },
      { cssOnly: true },
    );
  }, [tool, color, brushWidth, zoom, initial]);
  useEffect(() => {
    if (!overlayElement.current) return;
    let stopped = false;
    let rendering: RenderTask | undefined;
    const canvas = new Canvas(overlayElement.current, {
      width: initial.width,
      height: initial.height,
      preserveObjectStacking: true,
      selectionColor: "rgba(22,121,103,.12)",
      selectionBorderColor: "#167967",
    });
    instance.current = canvas;
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    const commit = () => {
      if (!stopped) onChange(initial.id, canvas.toJSON() as OverlayJSON);
    };
    canvas.on("object:modified", commit);
    canvas.on("path:created", commit);
    canvas.on("text:editing:exited", commit);
    canvas.on("mouse:down", (event) => {
      if (latest.current.tool !== "text") return;
      const text = new Textbox("Your text", {
        ...topLeft,
        left: event.scenePoint.x,
        top: event.scenePoint.y,
        width: Math.min(240, Math.max(80, initial.width - event.scenePoint.x)),
        fontSize: 22,
        fontFamily: "Arial",
        fill: latest.current.color,
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      canvas.requestRenderAll();
      commit();
      onSelectTool();
    });
    async function setup() {
      try {
        await canvas.loadFromJSON(initial.overlay);
        if (stopped) return;
        canvas.setDimensions(
          {
            width: initial.width * latest.current.zoom,
            height: initial.height * latest.current.zoom,
          },
          { cssOnly: true },
        );
        canvas.renderAll();
        if (initial.sourcePage !== null && backgroundElement.current) {
          const pdfPage = await doc.getPage(initial.sourcePage + 1);
          if (stopped) return;
          const rotation = (pdfPage.rotate + initial.rotation) % 360;
          const viewport = pdfPage.getViewport({ scale: 1.5, rotation });
          const node = backgroundElement.current;
          node.width = viewport.width;
          node.height = viewport.height;
          rendering = pdfPage.render({ canvas: node, viewport });
          await rendering.promise;
          const content = await pdfPage.getTextContent();
          const one = pdfPage.getViewport({ scale: 1, rotation });
          const { Util } = await pdfjs();
          const boxes: Region[] = [];
          for (const item of content.items) {
            if (!("str" in item) || !item.str.trim()) continue;
            const tx = Util.transform(one.transform, item.transform);
            const height = Math.hypot(tx[2], tx[3]);
            boxes.push({
              text: item.str,
              left: tx[4],
              top: tx[5] - height * 0.85,
              width: Math.max(item.width, 4),
              height: height * 1.15,
              angle: (Math.atan2(tx[1], tx[0]) * 180) / Math.PI,
            });
          }
          if (!stopped) setRegions(boxes);
        }
        if (!stopped) {
          onReady(canvas);
          setReady(true);
        }
      } catch (error) {
        if (!stopped)
          onError(error instanceof Error ? error.message : "Could not render editor page.");
      }
    }
    void setup();
    return () => {
      stopped = true;
      rendering?.cancel();
      onReady(null);
      instance.current = null;
      void canvas.dispose();
    };
  }, [doc, initial, onReady, onChange, onSelectTool, onError]);
  function replace(region: Region) {
    const canvas = instance.current;
    if (!canvas) return;
    const mask = new Rect({
      ...topLeft,
      left: region.left - 2,
      top: region.top - 2,
      width: region.width + 4,
      height: region.height + 4,
      fill: "#ffffff",
      angle: region.angle,
      strokeWidth: 0,
    });
    const text = new Textbox(region.text, {
      ...topLeft,
      left: region.left,
      top: region.top,
      width: region.width + 24,
      fontSize: region.height / 1.15,
      fill: "#222222",
      fontFamily: "Arial",
      angle: region.angle,
    });
    canvas.add(mask, text);
    canvas.setActiveObject(text);
    canvas.requestRenderAll();
    onChange(initial.id, canvas.toJSON() as OverlayJSON);
    onSelectTool();
  }
  return (
    <>
      <div
        className="editor-page-stage"
        style={{ width: initial.width * zoom, height: initial.height * zoom }}
      >
        <canvas className="editor-background" ref={backgroundElement} />
        <div className="editor-overlay">
          <canvas ref={overlayElement} aria-label="PDF editing canvas" />
        </div>
        {tool === "existing" && ready && (
          <div className="existing-text-regions">
            {regions.map((region, i) => (
              <button
                key={i}
                aria-label={`Edit existing text: ${region.text.slice(0, 50)}`}
                title={region.text}
                style={{
                  left: region.left * zoom,
                  top: region.top * zoom,
                  width: region.width * zoom,
                  height: region.height * zoom,
                  transform: `rotate(${region.angle}deg)`,
                }}
                onClick={() => replace(region)}
              />
            ))}
          </div>
        )}
        {!ready && <div className="editor-loading">Preparing page…</div>}
      </div>
      {tool === "existing" && ready && regions.length === 0 && (
        <p className="notice mt-4">
          Scanned document detected or no useful text layer found. Add text, a visual mask, drawing
          or a signature. OCR arrives in Phase 4.
        </p>
      )}
    </>
  );
}
