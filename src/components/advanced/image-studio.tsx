"use client";
import { useProcessingHistory } from "@/hooks/use-processing-history";
import { useEffect, useRef, useState } from "react";
import { Dropzone } from "@/components/upload/dropzone";
import { Button } from "@/components/ui/button";
import { Result } from "@/components/pdf/result";
import { imageCanvas, recognize } from "@/lib/advanced/ocr";
import { canvasBlob } from "@/lib/pdf/browser";
import type { Output } from "@/lib/pdf/types";
import { message, formatBytes } from "@/lib/utils";
type Layer = {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  background: string;
  opacity?: number;
  align?: CanvasTextAlign;
  font?: string;
  image?: string;
  width?: number;
  height?: number;
  maskWidth?: number;
  maskHeight?: number;
};
type Stroke = {
  id: string;
  kind: "draw" | "rectangle" | "ellipse";
  points: { x: number; y: number }[];
  color: string;
  width: number;
};
type Edit = {
  strokes: Stroke[];
  width: number;
  height: number;
  rotation: number;
  flip: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  grayscale: number;
  sepia: number;
  invert: number;
  crop: { x: number; y: number; width: number; height: number };
  layers: Layer[];
};
export function ImageStudio() {
  const beginHistory = useProcessingHistory();
  const [aspectLocked, setAspectLocked] = useState(false);
  const layerImages = useRef(new Map<string, HTMLImageElement>());
  const [drawingTool, setDrawingTool] = useState<"select" | "draw" | "rectangle" | "ellipse">(
    "select",
  );
  const [brushColor, setBrushColor] = useState("#111111");
  const [brushSize, setBrushSize] = useState(4);
  const stroke = useRef<Stroke | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [edit, setEdit] = useState<Edit>();
  const [past, setPast] = useState<Edit[]>([]);
  const [future, setFuture] = useState<Edit[]>([]);
  const [selected, setSelected] = useState("");
  const [mime, setMime] = useState("image/webp");
  const [quality, setQuality] = useState(0.8);
  const [output, setOutput] = useState<Output>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const preview = useRef<HTMLCanvasElement>(null);
  const source = useRef<HTMLCanvasElement | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);
  function update(next: Edit) {
    if (edit) setPast((p) => [...p, edit].slice(-30));
    setFuture([]);
    setEdit(next);
  }
  function draw(canvas: HTMLCanvasElement, img: HTMLCanvasElement, e: Edit) {
    canvas.width = e.width;
    canvas.height = e.height;
    const c = canvas.getContext("2d")!;
    c.save();
    c.translate(e.width / 2, e.height / 2);
    c.rotate((e.rotation * Math.PI) / 180);
    c.scale(e.flip ? -1 : 1, 1);
    c.filter = `brightness(${e.brightness}%) contrast(${e.contrast}%) saturate(${e.saturation}%) blur(${e.blur}px) grayscale(${e.grayscale}%) sepia(${e.sepia}%) invert(${e.invert}%)`;
    const rotated = e.rotation % 180 !== 0;
    const w = rotated ? e.height : e.width,
      h = rotated ? e.width : e.height;
    const crop = e.crop;
    c.drawImage(
      img,
      (img.width * crop.x) / 100,
      (img.height * crop.y) / 100,
      (img.width * crop.width) / 100,
      (img.height * crop.height) / 100,
      -w / 2,
      -h / 2,
      w,
      h,
    );
    c.restore();
    for (const shape of e.strokes) {
      c.strokeStyle = shape.color;
      c.lineWidth = shape.width;
      c.lineCap = "round";
      c.lineJoin = "round";
      const a = shape.points[0],
        b = shape.points.at(-1);
      if (!a || !b) continue;
      c.beginPath();
      if (shape.kind === "rectangle")
        c.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      else if (shape.kind === "ellipse")
        c.ellipse(
          (a.x + b.x) / 2,
          (a.y + b.y) / 2,
          Math.abs(b.x - a.x) / 2,
          Math.abs(b.y - a.y) / 2,
          0,
          0,
          Math.PI * 2,
        );
      else {
        c.moveTo(a.x, a.y);
        for (const point of shape.points) c.lineTo(point.x, point.y);
      }
      c.stroke();
    }
    for (const l of e.layers) {
      c.save();
      c.globalAlpha = l.opacity ?? 1;
      c.textAlign = l.align ?? "left";
      if (l.image) {
        const image = layerImages.current.get(l.image);
        if (image) c.drawImage(image, l.x, l.y, l.width ?? 200, l.height ?? 150);
        c.restore();
        continue;
      }
      c.font = `${l.size}px ${l.font ?? "Arial"}`;
      if (l.background !== "transparent") {
        c.fillStyle = l.background;
        c.fillRect(
          l.x,
          l.y - l.size,
          Math.max(l.maskWidth ?? 0, c.measureText(l.text).width + 8),
          Math.max(l.maskHeight ?? 0, l.size * 1.3),
        );
      }
      c.fillStyle = l.color;
      c.fillText(l.text, l.x, l.y);
      c.restore();
    }
  }
  useEffect(() => {
    if (edit && source.current && preview.current) draw(preview.current, source.current, edit);
  }, [edit]);
  async function select(fs: File[]) {
    const image = await imageCanvas(fs[0]);
    source.current = image;
    setFiles(fs);
    setEdit({
      width: image.width,
      height: image.height,
      rotation: 0,
      flip: false,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      blur: 0,
      grayscale: 0,
      sepia: 0,
      invert: 0,
      crop: { x: 0, y: 0, width: 100, height: 100 },
      layers: [],
      strokes: [],
    });
    setPast([]);
    setFuture([]);
    setOutput(undefined);
  }
  async function ocr() {
    if (!preview.current || !edit) return;
    const c = new AbortController();
    ctrl.current = c;
    setBusy(true);
    setError("");
    try {
      const result = await recognize(preview.current, c.signal, setProgress);
      const layers: Layer[] = [];
      for (const b of result.blocks ?? [])
        for (const p of b.paragraphs)
          for (const l of p.lines)
            layers.push({
              id: crypto.randomUUID(),
              text: l.text.trim(),
              x: l.bbox.x0,
              y: l.bbox.y1,
              size: Math.max(8, l.bbox.y1 - l.bbox.y0),
              maskWidth: l.bbox.x1 - l.bbox.x0,
              maskHeight: l.bbox.y1 - l.bbox.y0,
              color: "#111111",
              background: "#ffffff",
            });
      update({ ...edit, layers: [...edit.layers, ...layers].slice(0, 100) });
    } catch (e) {
      setError(c.signal.aborted ? "OCR cancelled." : message(e));
    } finally {
      setBusy(false);
    }
  }
  async function run() {
    if (!edit) return;
    const c = new AbortController();
    ctrl.current = c;
    setBusy(true);
    setError("");
    const finishHistory = beginHistory(files[0]?.name ?? "");
    let outcome: "COMPLETED" | "FAILED" | "CANCELLED" = "COMPLETED";
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      let single: Uint8Array | undefined;
      let total = 0;
      for (let i = 0; i < files.length; i++) {
        c.signal.throwIfAborted();
        const img = await imageCanvas(files[i]);
        const canvas = document.createElement("canvas");
        draw(canvas, img, edit);
        const blob = await canvasBlob(canvas, mime, quality);
        if (blob.type !== mime)
          throw new Error("This browser does not support the selected export format.");
        const bytes = new Uint8Array(await blob.arrayBuffer());
        total += bytes.length;
        if (total > 150 * 1024 * 1024) throw new Error("Output exceeds 150 MB.");
        single = bytes;
        zip.file(`${i + 1}-${files[i].name.replace(/\.[^.]+$/, "")}.${mime.split("/")[1]}`, bytes);
        canvas.width = canvas.height = img.width = img.height = 1;
        setProgress((i + 1) / files.length);
      }
      c.signal.throwIfAborted();
      setOutput({
        historyRecorded: true,
        bytes: files.length === 1 ? single! : await zip.generateAsync({ type: "uint8array" }),
        name: files.length === 1 ? `edited.${mime.split("/")[1]}` : "images.zip",
        mime: files.length === 1 ? mime : "application/zip",
        notice: `Input ${formatBytes(files.reduce((s, f) => s + f.size, 0))}; exported images ${formatBytes(total)}. PNG quality is lossless and may not reduce size. Batch files use the same dimensions, adjustments and overlays.`,
      });
    } catch (e) {
      outcome = c.signal.aborted ? "CANCELLED" : "FAILED";
      setError(c.signal.aborted ? "Export cancelled." : message(e));
    } finally {
      finishHistory(outcome);
      setBusy(false);
    }
  }
  if (output) return <Result output={output} onReset={() => setOutput(undefined)} />;
  const layer = edit?.layers.find((l) => l.id === selected);
  return (
    <div className="form-stack">
      <Dropzone accept=".jpg,.jpeg,.png,.webp" multiple onFiles={select} disabled={busy} />
      {edit && (
        <div className="tool-layout">
          <div className="panel">
            <canvas
              ref={preview}
              aria-label="Image preview"
              style={{
                maxWidth: "100%",
                maxHeight: 650,
                objectFit: "contain",
                touchAction: "none",
              }}
              onPointerDown={(e) => {
                if (drawingTool === "select" || busy || edit.strokes.length >= 200) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                const r = e.currentTarget.getBoundingClientRect();
                stroke.current = {
                  id: crypto.randomUUID(),
                  kind: drawingTool,
                  color: brushColor,
                  width: brushSize,
                  points: [
                    {
                      x: ((e.clientX - r.left) * edit.width) / r.width,
                      y: ((e.clientY - r.top) * edit.height) / r.height,
                    },
                  ],
                };
              }}
              onPointerMove={(e) => {
                const st = stroke.current;
                if (!st || !source.current) return;
                const r = e.currentTarget.getBoundingClientRect();
                const p = {
                  x: ((e.clientX - r.left) * edit.width) / r.width,
                  y: ((e.clientY - r.top) * edit.height) / r.height,
                };
                if (st.points.length < 10000) {
                  if (st.kind === "draw") st.points.push(p);
                  else st.points = [st.points[0], p];
                  draw(e.currentTarget, source.current, {
                    ...edit,
                    strokes: [...edit.strokes, st],
                  });
                }
              }}
              onPointerUp={() => {
                if (stroke.current) {
                  update({ ...edit, strokes: [...edit.strokes, stroke.current] });
                  stroke.current = null;
                }
              }}
              onPointerCancel={() => {
                stroke.current = null;
                if (source.current && preview.current) draw(preview.current, source.current, edit);
              }}
              onClick={(e) => {
                if (!layer || drawingTool !== "select" || busy) return;
                const r = e.currentTarget.getBoundingClientRect();
                update({
                  ...edit,
                  layers: edit.layers.map((l) =>
                    l.id === selected
                      ? {
                          ...l,
                          x: ((e.clientX - r.left) * edit.width) / r.width,
                          y: ((e.clientY - r.top) * edit.height) / r.height,
                        }
                      : l,
                  ),
                });
              }}
            />
            <p className="muted">
              {files.length} image(s). Preview shows the first image. Click to position a selected
              text layer.
            </p>
          </div>
          <section className="panel form-stack">
            <h2>Image studio</h2>
            <label>
              <input
                type="checkbox"
                checked={aspectLocked}
                onChange={(e) => setAspectLocked(e.target.checked)}
              />{" "}
              Lock aspect ratio
            </label>
            <label>
              Size preset
              <select
                className="field"
                defaultValue=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [width, height] = e.target.value.split("x").map(Number);
                  update({ ...edit, width, height });
                }}
              >
                <option value="">Custom</option>
                <option value="1080x1080">Instagram square</option>
                <option value="1200x630">Facebook landscape</option>
                <option value="1200x627">LinkedIn landscape</option>
                <option value="1280x720">YouTube thumbnail</option>
              </select>
            </label>
            <div className="flex gap-2">
              {[50, 75, 125, 150].map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const width = Math.round((edit.width * p) / 100),
                      height = Math.round((edit.height * p) / 100);
                    if (
                      width > 0 &&
                      height > 0 &&
                      width * height <= 40_000_000 &&
                      width <= 8000 &&
                      height <= 8000
                    )
                      update({ ...edit, width, height });
                  }}
                >
                  {p}%
                </Button>
              ))}
            </div>
            <label>
              Add image layer
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                disabled={busy || edit.layers.length >= 100}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    if (f.size > 5 * 1024 * 1024) throw new Error("Layer image exceeds 5 MB.");
                    const c = await imageCanvas(f);
                    const src = c.toDataURL("image/png");
                    const img = new Image();
                    img.src = src;
                    await img.decode();
                    layerImages.current.set(src, img);
                    const l = {
                      id: crypto.randomUUID(),
                      text: f.name,
                      x: 20,
                      y: 20,
                      size: 20,
                      color: "#111111",
                      background: "transparent",
                      image: src,
                      width: Math.min(c.width, edit.width / 2),
                      height: c.height * Math.min(1, edit.width / 2 / c.width),
                    };
                    update({ ...edit, layers: [...edit.layers, l] });
                    setSelected(l.id);
                  } catch (e) {
                    setError(message(e));
                  }
                }}
              />
            </label>
            <label>
              Canvas tool
              <select
                className="field"
                value={drawingTool}
                onChange={(e) => setDrawingTool(e.target.value as typeof drawingTool)}
              >
                <option value="select">Position text</option>
                <option value="draw">Freehand brush</option>
                <option value="rectangle">Rectangle</option>
                <option value="ellipse">Ellipse</option>
              </select>
            </label>
            <label>
              Brush color
              <input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
              />
            </label>
            <label>
              Brush width
              <input
                type="range"
                min={1}
                max={50}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
              />
            </label>
            {edit.strokes.length > 0 && (
              <details>
                <summary>Drawing layers ({edit.strokes.length})</summary>
                {edit.strokes.map((st, i) => (
                  <div key={st.id}>
                    {i + 1}. {st.kind}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        update({ ...edit, strokes: edit.strokes.filter((s) => s.id !== st.id) })
                      }
                    >
                      Delete drawing {i + 1}
                    </Button>
                  </div>
                ))}
              </details>
            )}

            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={!past.length || busy}
                onClick={() => {
                  setFuture([edit, ...future]);
                  setEdit(past.at(-1));
                  setPast(past.slice(0, -1));
                }}
              >
                Undo
              </Button>
              <Button
                variant="secondary"
                disabled={!future.length || busy}
                onClick={() => {
                  setPast([...past, edit]);
                  setEdit(future[0]);
                  setFuture(future.slice(1));
                }}
              >
                Redo
              </Button>
            </div>
            {(["width", "height"] as const).map((k) => (
              <label key={k}>
                {k}
                <input
                  className="field"
                  type="number"
                  min={1}
                  max={8000}
                  value={edit[k]}
                  onChange={(e) => {
                    const n = Math.max(1, Math.min(8000, Number(e.target.value)));
                    const other = k === "width" ? "height" : "width";
                    const dimension = aspectLocked
                      ? Math.max(1, Math.round((edit[other] * n) / edit[k]))
                      : edit[other];
                    if (n * dimension <= 40_000_000 && dimension <= 8000)
                      update({ ...edit, [k]: n, [other]: dimension });
                  }}
                />
              </label>
            ))}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  update({
                    ...edit,
                    rotation: (edit.rotation + 90) % 360,
                    width: edit.height,
                    height: edit.width,
                  })
                }
              >
                Rotate 90°
              </Button>
              <Button variant="secondary" onClick={() => update({ ...edit, flip: !edit.flip })}>
                Flip
              </Button>
            </div>
            <details>
              <summary>Crop (% of original image)</summary>
              {(["x", "y", "width", "height"] as const).map((k) => (
                <label key={k}>
                  {k}
                  <input
                    type="number"
                    className="field"
                    min={k === "width" || k === "height" ? 1 : 0}
                    max={100}
                    aria-label={`Crop ${k}`}
                    value={edit.crop[k]}
                    onChange={(e) => {
                      const crop = {
                        ...edit.crop,
                        [k]: Math.max(
                          k === "width" || k === "height" ? 1 : 0,
                          Math.min(100, Number(e.target.value)),
                        ),
                      };
                      if (crop.x + crop.width <= 100 && crop.y + crop.height <= 100)
                        update({ ...edit, crop });
                    }}
                  />
                </label>
              ))}
            </details>
            {(
              [
                "brightness",
                "contrast",
                "saturation",
                "blur",
                "grayscale",
                "sepia",
                "invert",
              ] as const
            ).map((k) => (
              <label key={k}>
                {k} {edit[k]}
                <input
                  type="range"
                  min={0}
                  max={k === "blur" ? 20 : 200}
                  value={edit[k]}
                  onChange={(e) => update({ ...edit, [k]: Number(e.target.value) })}
                />
              </label>
            ))}
            <Button
              variant="secondary"
              disabled={edit.layers.length >= 100}
              onClick={() => {
                const l = {
                  id: crypto.randomUUID(),
                  text: "Your text",
                  x: 20,
                  y: 50,
                  size: 32,
                  color: "#111111",
                  background: "transparent",
                };
                update({ ...edit, layers: [...edit.layers, l] });
                setSelected(l.id);
              }}
            >
              Add text layer
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void ocr()}>
              Detect text with OCR
            </Button>
            <p className="notice">
              OCR replacement covers pixels with a chosen background. It does not reconstruct
              textures or recover original fonts.
            </p>
            <label>
              Layers
              <select
                className="field"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Select a layer</option>
                {edit.layers.map((l, i) => (
                  <option key={l.id} value={l.id}>
                    {i + 1}. {l.text.slice(0, 30)}
                  </option>
                ))}
              </select>
            </label>
            {layer && (
              <>
                <label>
                  Layer opacity
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={layer.opacity ?? 1}
                    onChange={(e) =>
                      update({
                        ...edit,
                        layers: edit.layers.map((l) =>
                          l.id === selected ? { ...l, opacity: Number(e.target.value) } : l,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Text alignment
                  <select
                    value={layer.align ?? "left"}
                    onChange={(e) =>
                      update({
                        ...edit,
                        layers: edit.layers.map((l) =>
                          l.id === selected
                            ? { ...l, align: e.target.value as CanvasTextAlign }
                            : l,
                        ),
                      })
                    }
                  >
                    <option>left</option>
                    <option>center</option>
                    <option>right</option>
                  </select>
                </label>
                <label>
                  Text font
                  <select
                    value={layer.font ?? "Arial"}
                    onChange={(e) =>
                      update({
                        ...edit,
                        layers: edit.layers.map((l) =>
                          l.id === selected ? { ...l, font: e.target.value } : l,
                        ),
                      })
                    }
                  >
                    <option>Arial</option>
                    <option>Georgia</option>
                    <option>Courier New</option>
                  </select>
                </label>
                {layer.image &&
                  (["width", "height"] as const).map((k) => (
                    <label key={k}>
                      Layer {k}
                      <input
                        className="field"
                        type="number"
                        min={1}
                        max={8000}
                        value={layer[k]}
                        onChange={(e) =>
                          update({
                            ...edit,
                            layers: edit.layers.map((l) =>
                              l.id === selected
                                ? { ...l, [k]: Math.max(1, Math.min(8000, Number(e.target.value))) }
                                : l,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                <label>
                  Layer text
                  <input
                    className="field"
                    value={layer.text}
                    maxLength={500}
                    onChange={(e) =>
                      update({
                        ...edit,
                        layers: edit.layers.map((l) =>
                          l.id === selected ? { ...l, text: e.target.value } : l,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Text size
                  <input
                    type="number"
                    min={6}
                    max={300}
                    value={layer.size}
                    onChange={(e) =>
                      update({
                        ...edit,
                        layers: edit.layers.map((l) =>
                          l.id === selected
                            ? { ...l, size: Math.max(6, Math.min(300, Number(e.target.value))) }
                            : l,
                        ),
                      })
                    }
                  />
                </label>
                {(["color", "background"] as const).map((k) => (
                  <label key={k}>
                    {k}
                    <input
                      type="color"
                      value={layer[k] === "transparent" ? "#ffffff" : layer[k]}
                      onChange={(e) =>
                        update({
                          ...edit,
                          layers: edit.layers.map((l) =>
                            l.id === selected ? { ...l, [k]: e.target.value } : l,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
                <Button
                  variant="secondary"
                  onClick={() =>
                    update({ ...edit, layers: edit.layers.filter((l) => l.id !== selected) })
                  }
                >
                  Delete layer
                </Button>
              </>
            )}
            {layer && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    update({
                      ...edit,
                      layers: [...edit.layers.filter((l) => l.id !== selected), layer],
                    })
                  }
                >
                  Bring text to front
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    update({
                      ...edit,
                      layers: [layer, ...edit.layers.filter((l) => l.id !== selected)],
                    })
                  }
                >
                  Send text to back
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={edit.layers.length >= 100}
                  onClick={() =>
                    update({
                      ...edit,
                      layers: [
                        ...edit.layers,
                        { ...layer, id: crypto.randomUUID(), x: layer.x + 10, y: layer.y + 10 },
                      ],
                    })
                  }
                >
                  Duplicate text
                </Button>
              </div>
            )}
            <label>
              Export format
              <select className="field" value={mime} onChange={(e) => setMime(e.target.value)}>
                <option value="image/webp">WebP</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/png">PNG</option>
              </select>
            </label>
            <label>
              JPEG / WebP quality {Math.round(quality * 100)}%
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
              />
            </label>
            <Button disabled={busy} onClick={() => void run()}>
              Export images
            </Button>
          </section>
        </div>
      )}
      {busy && (
        <>
          <progress aria-label="Image processing progress" max={1} value={progress} />
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
    </div>
  );
}
