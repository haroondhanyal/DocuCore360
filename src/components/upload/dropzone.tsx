"use client";
import { useId, useRef, useState } from "react";
import { UploadCloud, Plus, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { validateFile, MAX_FILES, MAX_TOTAL_BYTES } from "@/lib/validation/files";
import { cn, message } from "@/lib/utils";
export function Dropzone({
  onFiles,
  accept = ".pdf",
  multiple = false,
  compact = false,
  disabled = false,
}: {
  onFiles: (files: File[]) => void | Promise<void>;
  accept?: string;
  multiple?: boolean;
  compact?: boolean;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function select(list: FileList | File[] | null) {
    if (!list || disabled || busy) return;
    setError("");
    const files = Array.from(list);
    try {
      if (!multiple && files.length > 1) throw new Error("Choose one file for this tool.");
      if (files.length > MAX_FILES) throw new Error(`Choose up to ${MAX_FILES} files at a time.`);
      if (files.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL_BYTES)
        throw new Error("Keep the combined selection below 100 MB.");
      setBusy(true);
      for (const file of files) {
        if (!accept.split(",").some((ext) => file.name.toLowerCase().endsWith(ext.trim())))
          throw new Error(`Choose a supported file: ${accept}`);
        validateFile(
          file.name,
          file.type,
          file.size,
          new Uint8Array(await file.slice(0, 12).arrayBuffer()),
        );
      }
      if (files.length) await onFiles(files);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div>
      <div
        className={cn("dropzone", drag && "dragging", compact && "min-h-0 py-5")}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void select(e.dataTransfer.files);
        }}
      >
        <input
          ref={input}
          id={id}
          className="sr-only"
          type="file"
          aria-label="Choose files"
          accept={accept}
          multiple={multiple}
          disabled={disabled || busy}
          onChange={(e) => void select(e.target.files)}
        />
        <div className="upload-icon">
          {busy ? <LoaderCircle className="spin" size={24} /> : <UploadCloud size={24} />}
        </div>
        <h3>
          {drag
            ? "Drop your files here"
            : multiple
              ? "Drag & drop your files here"
              : "Drag & drop your file here"}
        </h3>
        <p>Your next great document starts here</p>
        <Button type="button" onClick={() => input.current?.click()} disabled={disabled || busy}>
          <Plus size={15} />
          {busy ? "Checking files…" : multiple ? "Choose files" : "Choose a file"}
        </Button>
        <small>
          {accept.replaceAll(".", "").replaceAll(",", " · ").toUpperCase()} · Up to 25 MB each
        </small>
      </div>
      {error && (
        <div className="error mt-3" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
