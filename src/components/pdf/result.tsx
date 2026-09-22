"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { findTool } from "@/config/tools";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, FolderPlus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBytes } from "@/lib/pdf/browser";
import type { Output } from "@/lib/pdf/types";
import { api, type SessionUser } from "@/lib/api";
import { formatBytes, message } from "@/lib/utils";
export function Result({ output, onReset }: { output: Output; onReset: () => void }) {
  const [replaceId, setReplaceId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const client = useQueryClient();
  const { data } = useQuery({
    queryKey: ["session"],
    queryFn: () => api<{ user: SessionUser | null }>("/api/auth/session"),
  });
  const assets = useQuery({
    queryKey: ["files", "version-targets", data?.user?.id],
    queryFn: () =>
      api<{ files: { id: string; displayName: string; mimeType: string }[] }>("/api/files"),
    enabled: Boolean(data?.user),
  });
  const path = usePathname();
  const recorded = useRef<Output | null>(null);
  useEffect(() => {
    if (output.historyRecorded || !data?.user || recorded.current === output) return;
    const tool = findTool(path.split("/").pop() ?? "");
    if (!tool) return;
    recorded.current = output;
    void api("/api/history", {
      method: "POST",
      body: JSON.stringify({
        tool: tool.id,
        inputName: "",
        outputName: output.name.slice(0, 180),
        durationMs: 0,
        success: true,
      }),
    })
      .then(() => client.invalidateQueries({ queryKey: ["history"] }))
      .catch(() => {});
  }, [output, data?.user, path, client]);
  async function save() {
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.set(
        "file",
        new File([new Uint8Array(output.bytes)], output.name, { type: output.mime }),
      );
      form.set("save", "true");
      if (replaceId) form.set("replaceId", replaceId);
      await api("/api/files/upload", { method: "POST", body: form });
      setSaved(true);
      await client.invalidateQueries({ queryKey: ["files"] });
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="panel result-panel" role="status">
      <span className="result-icon">
        <Check size={32} />
      </span>
      <h2>Your document is ready.</h2>
      <p>
        {output.name} · {formatBytes(output.bytes.length)}
      </p>
      {data?.user && output.saveable !== false && (
        <label className="mb-4">
          Save destination
          <select
            className="field"
            aria-label="Save destination"
            value={replaceId}
            onChange={(e) => setReplaceId(e.target.value)}
            disabled={saved || saving}
          >
            <option value="">New file</option>
            {assets.data?.files
              .filter((f) => f.mimeType === output.mime)
              .map((f) => (
                <option key={f.id} value={f.id}>
                  New version of {f.displayName}
                </option>
              ))}
          </select>
        </label>
      )}
      <div className="flex gap-3 flex-wrap justify-center">
        <Button onClick={() => downloadBytes(output.bytes, output.name, output.mime)}>
          <Download size={16} />
          Download result
        </Button>
        {output.mime !== "application/zip" &&
          output.saveable !== false &&
          (data?.user ? (
            <Button variant="secondary" onClick={() => void save()} disabled={saving || saved}>
              <FolderPlus size={16} />
              {saved ? "Saved to My Files" : saving ? "Saving…" : "Save to My Files"}
            </Button>
          ) : (
            <Button asChild variant="secondary">
              <Link href="/login">Sign in to save files</Link>
            </Button>
          ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p>Your original is unchanged. This result stays in memory until you leave or start again.</p>
      {output.notice && <p className="notice max-w-2xl">{output.notice}</p>}
      <Button variant="ghost" onClick={onReset}>
        <RotateCcw size={14} />
        Process another file
      </Button>
    </div>
  );
}
