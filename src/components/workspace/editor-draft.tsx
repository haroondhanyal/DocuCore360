"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { EditorPage } from "@/lib/pdf/editor-types";
import { message } from "@/lib/utils";
import { CloudDraft } from "./cloud-draft";
type Draft = { name: string; bytes: ArrayBuffer; pages: EditorPage[]; savedAt: number };
async function transaction(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("docucore-local-drafts", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("drafts");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  try {
    return await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction("drafts", mode);
      const r = action(tx.objectStore("drafts"));
      tx.oncomplete = () => resolve(r.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export function EditorDraft({
  name,
  bytes,
  pages,
  onRestore,
}: {
  name: string;
  bytes: ArrayBuffer | null;
  pages: EditorPage[];
  onRestore: (draft: Draft) => Promise<void>;
}) {
  const [auto, setAuto] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!auto || !bytes || !pages.length) return;
    const timer = setTimeout(() => {
      if (JSON.stringify(pages).length > 30 * 1024 * 1024) {
        setError("Draft exceeds 30 MB of annotations.");
        return;
      }
      void transaction("readwrite", (s) =>
        s.put({ name, bytes, pages, savedAt: Date.now() }, "current"),
      )
        .then(() => setStatus("Draft saved on this browser."))
        .catch((e) => setError(message(e)));
    }, 1500);
    return () => clearTimeout(timer);
  }, [auto, bytes, name, pages]);
  async function act(kind: "save" | "restore" | "delete") {
    setBusy(true);
    setError("");
    try {
      if (kind === "save") {
        if (!bytes) return;
        if (JSON.stringify(pages).length > 30 * 1024 * 1024)
          throw new Error("Draft exceeds 30 MB of annotations.");
        await transaction("readwrite", (s) =>
          s.put({ name, bytes, pages, savedAt: Date.now() }, "current"),
        );
        setStatus("Draft saved on this browser.");
      } else if (kind === "delete") {
        setAuto(false);
        await transaction("readwrite", (s) => s.delete("current"));
        setStatus("Local draft deleted.");
      } else {
        const draft = (await transaction("readonly", (s) => s.get("current"))) as Draft | undefined;
        if (!draft) throw new Error("No saved draft in this browser.");
        if (bytes && !window.confirm("Replace the current editor document with the saved draft?"))
          return;
        await onRestore(draft);
        setStatus(`Restored draft from ${new Date(draft.savedAt).toLocaleString()}`);
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <CloudDraft name={name} bytes={bytes} pages={pages} onRestore={onRestore} />
      <div className="panel form-stack mb-4">
        <div className="flex gap-3 flex-wrap items-center">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !bytes}
            onClick={() => void act("save")}
          >
            Save local draft
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act("restore")}>
            Restore local draft
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act("delete")}>
            Delete local draft
          </Button>
          <label>
            <input
              type="checkbox"
              checked={auto}
              disabled={!bytes}
              onChange={(e) => setAuto(e.target.checked)}
            />{" "}
            Autosave on this browser
          </label>
        </div>
        <p className="muted text-xs">
          Opt-in: one editable draft, including the source PDF, stays in this browser until deleted.
          It is shared by anyone using this browser profile; it does not sync to your account.
        </p>
        {status && <p role="status">{status}</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
