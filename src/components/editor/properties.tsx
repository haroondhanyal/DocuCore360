"use client";
import { FabricObject, FabricText } from "fabric";
import { ArrowDown, ArrowUp, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
export function EditorProperties({
  object,
  onUpdate,
  onDuplicate,
  onDelete,
  onLayer,
}: {
  object: FabricObject | null;
  onUpdate: (values: Record<string, unknown>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onLayer: (forward: boolean) => void;
}) {
  const text = object instanceof FabricText ? object : null;
  if (!object)
    return (
      <aside className="editor-properties">
        <h2>Properties</h2>
        <div className="empty-state">
          <strong>Make it your own.</strong>
          <p>Select an object to edit its appearance, or choose a tool to add something new.</p>
        </div>
        <p className="text-[10px] muted leading-5">
          Text: click on the page to place it.
          <br />
          Select: move, resize or rotate objects.
          <br />
          Double-click added text to type directly.
        </p>
      </aside>
    );
  return (
    <aside className="editor-properties">
      <h2>{text ? "Text properties" : "Object properties"}</h2>
      <div className="form-stack">
        {text && (
          <>
            <label className="field">
              Text content
              <textarea
                aria-label="Text content"
                rows={3}
                maxLength={5000}
                value={text.text}
                onChange={(e) => onUpdate({ text: e.target.value })}
              />
            </label>
            <label className="field">
              Font
              <select
                aria-label="Font family"
                value={text.fontFamily}
                onChange={(e) => onUpdate({ fontFamily: e.target.value })}
              >
                {["Arial", "Times New Roman", "Courier New", "Georgia", "cursive"].map((font) => (
                  <option key={font}>{font}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="field">
                Font size
                <input
                  aria-label="Font size"
                  type="number"
                  min={6}
                  max={200}
                  value={Math.round(text.fontSize)}
                  onChange={(e) =>
                    onUpdate({ fontSize: Math.max(6, Math.min(200, Number(e.target.value))) })
                  }
                />
              </label>
              <label className="field">
                Alignment
                <select
                  aria-label="Text alignment"
                  value={text.textAlign}
                  onChange={(e) => onUpdate({ textAlign: e.target.value })}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                  <option value="justify">Justify</option>
                </select>
              </label>
            </div>
            <div className="flex gap-1">
              <Button
                variant="secondary"
                size="sm"
                aria-label="Bold"
                aria-pressed={text.fontWeight === "bold"}
                onClick={() =>
                  onUpdate({ fontWeight: text.fontWeight === "bold" ? "normal" : "bold" })
                }
              >
                <b>B</b>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label="Italic"
                aria-pressed={text.fontStyle === "italic"}
                onClick={() =>
                  onUpdate({ fontStyle: text.fontStyle === "italic" ? "normal" : "italic" })
                }
              >
                <i>I</i>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label="Underline text"
                aria-pressed={text.underline}
                onClick={() => onUpdate({ underline: !text.underline })}
              >
                <u>U</u>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label="Strikeout text"
                aria-pressed={text.linethrough}
                onClick={() => onUpdate({ linethrough: !text.linethrough })}
              >
                <s>S</s>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="field">
                Line spacing
                <input
                  aria-label="Line spacing"
                  type="number"
                  min={0.5}
                  max={3}
                  step={0.1}
                  value={text.lineHeight}
                  onChange={(e) =>
                    onUpdate({ lineHeight: Math.max(0.5, Math.min(3, Number(e.target.value))) })
                  }
                />
              </label>
              <label className="field">
                Letter spacing
                <input
                  aria-label="Letter spacing"
                  type="number"
                  min={-100}
                  max={1000}
                  step={10}
                  value={text.charSpacing}
                  onChange={(e) =>
                    onUpdate({
                      charSpacing: Math.max(-100, Math.min(1000, Number(e.target.value))),
                    })
                  }
                />
              </label>
            </div>
            <label className="field">
              Text background
              <input
                aria-label="Text background"
                type="color"
                value={
                  typeof text.textBackgroundColor === "string" &&
                  /^#[a-f0-9]{6}$/i.test(text.textBackgroundColor)
                    ? text.textBackgroundColor
                    : "#ffffff"
                }
                onChange={(e) => onUpdate({ textBackgroundColor: e.target.value })}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onUpdate({ textBackgroundColor: "" })}
              >
                Remove background
              </Button>
            </label>
          </>
        )}
        <label className="field">
          {text ? "Text color" : "Fill color"}
          <input
            aria-label="Object color"
            type="color"
            value={
              typeof object.fill === "string" && /^#[a-f0-9]{6}$/i.test(object.fill)
                ? object.fill
                : "#167967"
            }
            onChange={(e) => onUpdate({ fill: e.target.value })}
          />
        </label>
        {!text && (
          <label className="field">
            Stroke color
            <input
              aria-label="Stroke color"
              type="color"
              value={
                typeof object.stroke === "string" && /^#[a-f0-9]{6}$/i.test(object.stroke)
                  ? object.stroke
                  : "#167967"
              }
              onChange={(e) => onUpdate({ stroke: e.target.value })}
            />
          </label>
        )}
        <label className="field">
          Opacity: {Math.round(object.opacity * 100)}%
          <input
            aria-label="Object opacity"
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={object.opacity}
            onChange={(e) => onUpdate({ opacity: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          Rotation
          <input
            aria-label="Object rotation"
            type="number"
            min={-360}
            max={360}
            value={Math.round(object.angle)}
            onChange={(e) =>
              onUpdate({ angle: Math.max(-360, Math.min(360, Number(e.target.value))) })
            }
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onDuplicate}>
            <Copy size={13} />
            Duplicate
          </Button>
          <Button variant="secondary" size="sm" onClick={onDelete}>
            <Trash2 size={13} />
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onLayer(true)}>
            <ArrowUp size={13} />
            Forward
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onLayer(false)}>
            <ArrowDown size={13} />
            Backward
          </Button>
        </div>
      </div>
    </aside>
  );
}
