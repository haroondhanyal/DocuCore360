"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { setPendingFiles } from "@/lib/pending-file";
import { message } from "@/lib/utils";
export function FileActions({
  file,
  folders,
}: {
  file: {
    id: string;
    displayName: string;
    mimeType: string;
    folderId: string | null;
    favorite: boolean;
  };
  folders: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const router = useRouter();
  const versions = useQuery({
    queryKey: ["versions", file.id],
    queryFn: () =>
      api<{ versions: { id: string; label: string; createdAt: string }[] }>(
        `/api/files/${file.id}/versions`,
      ),
    enabled: open,
  });
  async function action(url: string, method: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(url, { method, body: JSON.stringify(body) });
      await Promise.all([
        client.invalidateQueries({ queryKey: ["files"] }),
        client.invalidateQueries({ queryKey: ["versions", file.id] }),
      ]);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function process() {
    setBusy(true);
    try {
      const res = await fetch(`/api/files/${file.id}`);
      if (!res.ok) throw new Error("Cannot load saved file.");
      const bytes = await res.arrayBuffer();
      setPendingFiles([new File([bytes], file.displayName, { type: file.mimeType })]);
      router.push(file.mimeType === "application/pdf" ? "/tools/edit-pdf" : "/tools/images-to-pdf");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        aria-label={`Favorite ${file.displayName}`}
        onClick={() => void action(`/api/files/${file.id}`, "PATCH", { favorite: !file.favorite })}
      >
        {file.favorite ? "★" : "☆"}
      </Button>
      <select
        aria-label={`Folder for ${file.displayName}`}
        disabled={busy}
        value={file.folderId ?? ""}
        onChange={(e) =>
          void action(`/api/files/${file.id}`, "PATCH", { folderId: e.target.value || null })
        }
      >
        <option value="">Unfiled</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Versions
      </Button>
      {(file.mimeType === "application/pdf" || file.mimeType.startsWith("image/")) && (
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void process()}>
          Open in tool
        </Button>
      )}
      {error && (
        <span className="error" role="alert">
          {error}
        </span>
      )}
      <Dialog open={open} onOpenChange={setOpen} title={`Versions: ${file.displayName}`}>
        <p className="notice">
          Snapshots preserve this saved file. Restore replaces the current saved copy. Keep a
          snapshot first if you need it.
        </p>
        <div className="form-stack">
          <label>
            Snapshot label
            <input
              className="field"
              value={label}
              maxLength={80}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <Button
            disabled={busy || !label.trim()}
            onClick={() => void action(`/api/files/${file.id}/versions`, "POST", { label })}
          >
            Create snapshot
          </Button>
          {versions.data?.versions.map((v) => (
            <div className="flex gap-3 items-center" key={v.id}>
              <span>{v.label}</span>
              <a href={`/api/files/${file.id}/versions?download=${v.id}`} download>
                Download
              </a>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Restore this version as the current saved copy?"))
                    void action(`/api/files/${file.id}/versions`, "PATCH", { id: v.id });
                }}
              >
                Restore
              </Button>
            </div>
          ))}
          {versions.error && <p className="error">{versions.error.message}</p>}
          {!versions.data?.versions.length && <p>No snapshots yet.</p>}
        </div>
      </Dialog>
    </>
  );
}
