"use client";
import { useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
export function SignatureDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (url: string) => Promise<void>;
}) {
  const [mode, setMode] = useState("draw");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const down = useRef(false);
  const drawn = useRef(false);
  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * 640) / rect.width,
      y: ((event.clientY - rect.top) * 220) / rect.height,
    };
  }
  async function add() {
    setError("");
    let url: string;
    if (mode === "draw") {
      if (!drawn.current || !canvas.current) {
        setError("Draw your signature first.");
        return;
      }
      url = canvas.current.toDataURL("image/png");
    } else {
      if (!name.trim()) {
        setError("Type your name or initials.");
        return;
      }
      const node = document.createElement("canvas");
      node.width = 640;
      node.height = 180;
      const ctx = node.getContext("2d")!;
      ctx.font = "italic 62px Georgia";
      ctx.fillStyle = "#172c42";
      ctx.fillText(name.trim(), 15, 105, 610);
      url = node.toDataURL("image/png");
    }
    setBusy(true);
    try {
      await onAdd(url);
      onOpenChange(false);
      setName("");
      drawn.current = false;
    } catch {
      setError("The signature could not be added.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Your signature">
      <p className="muted text-xs leading-6 mb-4">
        A visual signature, not a certificate-based digital signature. It stays in this document and
        is not saved for reuse.
      </p>
      <div className="tabs">
        <button
          className={`tab ${mode === "draw" ? "active" : ""}`}
          onClick={() => {
            setMode("draw");
            drawn.current = false;
          }}
        >
          Draw
        </button>
        <button
          className={`tab ${mode === "type" ? "active" : ""}`}
          onClick={() => setMode("type")}
        >
          Type
        </button>
      </div>
      {mode === "draw" ? (
        <>
          <canvas
            ref={canvas}
            width={640}
            height={220}
            className="signature-canvas"
            aria-label="Draw your signature"
            onPointerDown={(e) => {
              down.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              const p = point(e);
              const ctx = e.currentTarget.getContext("2d")!;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
            }}
            onPointerMove={(e) => {
              if (!down.current) return;
              const p = point(e);
              const ctx = e.currentTarget.getContext("2d")!;
              ctx.lineWidth = 3;
              ctx.lineCap = "round";
              ctx.strokeStyle = "#172c42";
              ctx.lineTo(p.x, p.y);
              ctx.stroke();
              drawn.current = true;
            }}
            onPointerUp={() => {
              down.current = false;
            }}
            onPointerCancel={() => {
              down.current = false;
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              canvas.current?.getContext("2d")?.clearRect(0, 0, 640, 220);
              drawn.current = false;
            }}
          >
            Clear drawing
          </Button>
        </>
      ) : (
        <label className="field">
          Name or initials
          <input
            aria-label="Signature name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Your signature"
          />
          <span className="signature-preview">{name || "Your signature"}</span>
        </label>
      )}
      <p className="muted text-[10px] my-3">
        For an uploaded signature, close this dialog and use the Image tool.
      </p>
      {error && <p className="error my-3">{error}</p>}
      <Button className="w-full mt-3" disabled={busy} onClick={() => void add()}>
        Add signature
      </Button>
    </Dialog>
  );
}
