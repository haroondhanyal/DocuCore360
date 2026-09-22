"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type SessionUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { EditorPage } from "@/lib/pdf/editor-types";
import { message } from "@/lib/utils";
function base64(bytes: ArrayBuffer) {
  const b = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode(...b.subarray(i, i + 32768));
  return btoa(s);
}
export function CloudDraft({
  name,
  bytes,
  pages,
  onRestore,
}: {
  name: string;
  bytes: ArrayBuffer | null;
  pages: EditorPage[];
  onRestore: (draft: {
    name: string;
    bytes: ArrayBuffer;
    pages: EditorPage[];
    savedAt: number;
  }) => Promise<void>;
}) {
  const client = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api<{ user: SessionUser | null }>("/api/auth/session"),
  });
  const list = useQuery({
    queryKey: ["cloud-drafts", session.data?.user?.id],
    queryFn: () =>
      api<{ drafts: { id: string; name: string; revision: number; updatedAt: string }[] }>(
        "/api/drafts",
      ),
    enabled: Boolean(session.data?.user),
  });
  const [id, setId] = useState("");
  const [revision, setRevision] = useState(0);
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const lock = useRef(false);
  const boundSource = useRef<ArrayBuffer | null>(null);
  async function save(copy = false) {
    if (!bytes || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const target = !copy && boundSource.current === bytes ? id : "";
      const result = await api<{ id: string; revision: number }>(
        target ? `/api/drafts/${target}` : "/api/drafts",
        {
          method: target ? "PUT" : "POST",
          body: JSON.stringify({ name, source: base64(bytes), pages, revision }),
        },
      );
      boundSource.current = bytes;
      setId(result.id);
      setRevision(result.revision);
      setStatus(`Account draft saved · revision ${result.revision}`);
      await client.invalidateQueries({ queryKey: ["cloud-drafts"] });
    } catch (e) {
      setAuto(false);
      setError(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!auto || !bytes || !id || boundSource.current !== bytes) return;
    const timer = setTimeout(() => {
      void save();
    }, 3000);
    return () => clearTimeout(timer); // Save the latest edited document; save completion itself must not schedule another upload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, auto, bytes]);
  async function restore() {
    if (!id || lock.current) return;
    if (bytes && !window.confirm("Replace current edits with this account draft?")) return;
    setBusy(true);
    setError("");
    setAuto(false);
    try {
      const d = await api<{ name: string; source: string; pages: EditorPage[]; revision: number }>(
        `/api/drafts/${id}`,
      );
      const raw = atob(d.source);
      const input = Uint8Array.from(raw, (c) => c.charCodeAt(0)).buffer;
      await onRestore({ name: d.name, bytes: input, pages: d.pages, savedAt: Date.now() });
      boundSource.current = input;
      setRevision(d.revision);
      setStatus(`Restored account draft · revision ${d.revision}`);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (!session.data?.user) return null;
  return (
    <div className="panel form-stack mb-4">
      <h3>Account drafts</h3>
      <p className="muted text-xs">
        Saving uploads the source PDF and editable annotations to your private account. Available on
        your other devices. Autosave starts only after an explicit save; concurrent changes are
        rejected.
      </p>
      <div className="flex gap-3 flex-wrap">
        <select
          aria-label="Account draft"
          value={id}
          disabled={busy}
          onChange={(e) => {
            setId(e.target.value);
            setRevision(0);
            boundSource.current = null;
            setAuto(false);
          }}
        >
          <option value="">Choose a saved draft</option>
          {list.data?.drafts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} · v{d.revision}
            </option>
          ))}
        </select>
        <Button variant="secondary" size="sm" disabled={busy || !bytes} onClick={() => void save()}>
          Save account draft
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy || !bytes}
          onClick={() => void save(true)}
        >
          Save new draft copy
        </Button>
        <Button variant="secondary" size="sm" disabled={busy || !id} onClick={() => void restore()}>
          Restore account draft
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || !id}
          onClick={async () => {
            if (!window.confirm("Delete this account draft?")) return;
            setBusy(true);
            setAuto(false);
            try {
              await api(`/api/drafts/${id}`, { method: "DELETE" });
              setId("");
              setRevision(0);
              setStatus("Account draft deleted.");
              await client.invalidateQueries({ queryKey: ["cloud-drafts"] });
            } catch (e) {
              setError(message(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Delete account draft
        </Button>
      </div>
      <label>
        <input
          type="checkbox"
          checked={auto}
          disabled={busy || !id || !revision}
          onChange={(e) => setAuto(e.target.checked)}
        />{" "}
        Autosave to account
      </label>
      {status && <p role="status">{status}</p>}
      {(error || list.error) && (
        <p role="alert" className="error">
          {error || list.error?.message}
        </p>
      )}
    </div>
  );
}
