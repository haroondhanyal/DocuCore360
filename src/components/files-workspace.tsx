"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  FileText,
  FolderOpen,
  Search,
  Trash2,
  Pencil,
  Upload,
  ShieldCheck,
} from "lucide-react";
import { api, type SessionUser } from "@/lib/api";
import { formatBytes, message } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Dropzone } from "@/components/upload/dropzone";
import { FileActions } from "@/components/workspace/file-actions";
type Asset = {
  folderId: string | null;
  favorite: boolean;
  id: string;
  displayName: string;
  fileSize: number;
  mimeType: string;
  pageCount: number | null;
  createdAt: string;
};
export function FilesWorkspace({ recent = false }: { recent?: boolean }) {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [folder, setFolder] = useState("all");
  const [parentFolder, setParentFolder] = useState("");
  const [folderName, setFolderName] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Asset | null>(null);
  const [rename, setRename] = useState<Asset | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState("date");
  const [type, setType] = useState("all");
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api<{ user: SessionUser | null }>("/api/auth/session"),
  });
  const files = useQuery({
    queryKey: ["files", session.data?.user?.id, page, search, folder, onlyFavorites, type, sort],
    queryFn: () =>
      api<{
        files: Asset[];
        total: number;
        pageSize: number;
        stats: { files: number; bytes: number };
      }>(
        `/api/files?${new URLSearchParams({ page: String(page), search, folder, favorite: String(onlyFavorites), type, sort })}`,
      ),
    enabled: Boolean(session.data?.user),
  });
  const folders = useQuery({
    queryKey: ["folders", session.data?.user?.id],
    queryFn: () =>
      api<{ folders: { id: string; name: string; parentId: string | null }[] }>("/api/folders"),
    enabled: Boolean(session.data?.user),
  });
  async function folderAction(method: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await api("/api/folders", { method, body: JSON.stringify(body) });
      setFolderName("");
      await client.invalidateQueries({ queryKey: ["folders"] });
      await client.invalidateQueries({ queryKey: ["files"] });
      if (method === "DELETE") setFolder("all");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function upload(selected: File[]) {
    setBusy(true);
    setError("");
    try {
      for (const file of selected) {
        const form = new FormData();
        form.set("file", file);
        form.set("save", "true");
        await api("/api/files/upload", { method: "POST", body: form });
      }
      setUploadOpen(false);
    } catch (e) {
      setError(message(e));
    } finally {
      await client.invalidateQueries({ queryKey: ["files"] });
      setBusy(false);
    }
  }
  async function remove() {
    if (!pendingDelete) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/files/${pendingDelete.id}`, { method: "DELETE" });
      setPendingDelete(null);
      await client.invalidateQueries({ queryKey: ["files"] });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!rename) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/files/${rename.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
      setRename(null);
      await client.invalidateQueries({ queryKey: ["files"] });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const list = (files.data?.files ?? [])
    .filter(
      (f) =>
        f.displayName.toLowerCase().includes(search.toLowerCase()) &&
        (folder === "all" || (f.folderId ?? "unfiled") === folder) &&
        (!onlyFavorites || f.favorite) &&
        (type === "all" ||
          (type === "pdf" ? f.mimeType === "application/pdf" : f.mimeType.startsWith("image/"))),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.displayName.localeCompare(b.displayName)
        : sort === "size"
          ? b.fileSize - a.fileSize
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  return (
    <>
      <div className="page-intro">
        <div>
          <h1>{recent ? "Recently saved files" : "My files"}</h1>
          <p>Your saved documents, right where you need them.</p>
        </div>
        {session.data?.user && (
          <Button onClick={() => setUploadOpen(true)}>
            <Upload size={15} />
            Save files
          </Button>
        )}
      </div>
      <div className="notice mb-6">
        <ShieldCheck size={17} />
        <span>
          Only files you explicitly save are stored here. Guest processing does not upload files.
          Use folders and snapshots to organize saved copies.
        </span>
      </div>
      {(error || files.error || session.error) && (
        <p className="error mb-4" role="alert">
          {error || files.error?.message || session.error?.message}
        </p>
      )}
      {session.isPending ? (
        <p className="muted">Loading your workspace…</p>
      ) : !session.data?.user ? (
        <div className="panel empty-state py-12">
          <FolderOpen size={35} />
          <strong>Your documents deserve a home.</strong>
          <p>
            Sign in to save, download and manage files. You can use core PDF tools without an
            account.
          </p>
          <Button asChild className="mt-3">
            <Link href="/login">Sign in to your workspace</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="panel stat">
              <small>Saved files</small>
              <strong>{files.data?.stats.files ?? "—"}</strong>
            </div>
            <div className="panel stat">
              <small>Storage used</small>
              <strong>{files.data ? formatBytes(files.data.stats.bytes) : "—"}</strong>
            </div>
            <div className="panel stat">
              <small>Workspace plan</small>
              <strong>Free</strong>
            </div>
          </div>
          <div className="panel mb-4 flex gap-3 flex-wrap items-center">
            <label>
              Folder{" "}
              <select
                aria-label="Filter folder"
                value={folder}
                onChange={(e) => {
                  setFolder(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All folders</option>
                <option value="unfiled">Unfiled</option>
                {folders.data?.folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={onlyFavorites}
                onChange={(e) => {
                  setOnlyFavorites(e.target.checked);
                  setPage(1);
                }}
              />{" "}
              Favorite files
            </label>
            <input
              aria-label="Folder name"
              placeholder="New folder name"
              value={folderName}
              maxLength={80}
              onChange={(e) => setFolderName(e.target.value)}
            />
            <label>
              Parent folder
              <select
                aria-label="Parent folder"
                value={parentFolder}
                onChange={(e) => setParentFolder(e.target.value)}
              >
                <option value="">Root</option>
                {folders.data?.folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="secondary"
              disabled={busy || !folderName.trim()}
              onClick={() =>
                void folderAction("POST", { name: folderName, parentId: parentFolder || null })
              }
            >
              Create folder
            </Button>
            {folder !== "all" && folder !== "unfiled" && (
              <>
                <Button
                  variant="secondary"
                  disabled={busy || !folderName.trim()}
                  onClick={() =>
                    void folderAction("PATCH", {
                      id: folder,
                      name: folderName,
                      parentId: parentFolder || null,
                    })
                  }
                >
                  Rename folder
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Delete this folder? Its files will become unfiled."))
                      void folderAction("DELETE", { id: folder });
                  }}
                >
                  Delete folder
                </Button>
              </>
            )}
          </div>
          <div className="panel">
            <div className="flex gap-3 mb-5 flex-wrap items-center">
              <Search size={17} className="muted" />
              <input
                className="flex-1"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search your files…"
                aria-label="Search saved files"
              />
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(1);
                }}
                aria-label="File type"
              >
                <option value="all">All types</option>
                <option value="pdf">PDF</option>
                <option value="image">Images</option>
              </select>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
                aria-label="Sort files"
              >
                <option value="date">Newest first</option>
                <option value="name">Name</option>
                <option value="size">Largest first</option>
              </select>
            </div>
            {files.isPending ? (
              <p className="muted">Loading saved files…</p>
            ) : list.length ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>DOCUMENT</th>
                      <th>SAVED</th>
                      <th>SIZE</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((file) => (
                      <tr key={file.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <FileText size={18} className="text-[var(--primary)]" />
                            <span>{file.displayName}</span>
                          </div>
                        </td>
                        <td>{new Date(file.createdAt).toLocaleDateString()}</td>
                        <td>{formatBytes(file.fileSize)}</td>
                        <td>
                          <div className="actions flex-wrap">
                            <FileActions file={file} folders={folders.data?.folders ?? []} />
                            <Button asChild size="icon" variant="ghost">
                              <a
                                href={`/api/files/${file.id}`}
                                download
                                aria-label={`Download ${file.displayName}`}
                              >
                                <Download size={15} />
                              </a>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Rename ${file.displayName}`}
                              onClick={() => {
                                setRename(file);
                                setName(file.displayName);
                              }}
                            >
                              <Pencil size={15} />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Delete ${file.displayName}`}
                              onClick={() => setPendingDelete(file)}
                            >
                              <Trash2 size={15} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <FolderOpen size={30} />
                <strong>{search ? "No matching files" : "A fresh workspace"}</strong>
                <p>Save a result from any core tool, or upload a document here.</p>
              </div>
            )}
          </div>
        </>
      )}
      {session.data?.user && (
        <div className="flex gap-3 items-center my-4">
          <Button
            variant="secondary"
            disabled={page <= 1 || files.isFetching}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous files
          </Button>
          <span>
            Page {page} of {Math.max(1, Math.ceil((files.data?.total ?? 0) / 50))} ·{" "}
            {files.data?.total ?? 0} matching files
          </span>
          <Button
            variant="secondary"
            disabled={page * 50 >= (files.data?.total ?? 0) || files.isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            Next files
          </Button>
        </div>
      )}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen} title="Save to My Files">
        <p className="muted text-xs leading-6 mb-5">
          These files will be uploaded to your private account and kept until you delete them.
        </p>
        <Dropzone
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.txt,.csv,.html"
          onFiles={upload}
          disabled={busy}
        />
        {error && <p className="error mt-3">{error}</p>}
      </Dialog>
      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete saved file?"
      >
        <p className="muted text-sm leading-6 mb-6">
          Remove “{pendingDelete?.displayName}” from your workspace? This deletes the saved copy.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setPendingDelete(null)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => void remove()}>
            Delete file
          </Button>
        </div>
        {error && <p className="error mt-3">{error}</p>}
      </Dialog>
      <Dialog
        open={Boolean(rename)}
        onOpenChange={(open) => {
          if (!open) setRename(null);
        }}
        title="Rename file"
      >
        <form onSubmit={saveName} className="form-stack">
          <label className="field">
            Display name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={180}
            />
          </label>
          <Button type="submit" disabled={busy}>
            Save name
          </Button>
          {error && <p className="error">{error}</p>}
        </form>
      </Dialog>
    </>
  );
}
