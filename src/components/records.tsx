"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, type SessionUser } from "@/lib/api";
import { FilesWorkspace } from "@/components/files-workspace";
import { History } from "@/components/workspace/history";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";
export function Records() {
  const [section, setSection] = useState("Saved files");
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api<{ user: SessionUser | null }>("/api/auth/session"),
  });
  const drafts = useQuery({
    queryKey: ["cloud-drafts", session.data?.user?.id],
    enabled: Boolean(session.data?.user),
    queryFn: () =>
      api<{
        drafts: {
          id: string;
          name: string;
          fileSize: number;
          revision: number;
          updatedAt: string;
        }[];
      }>("/api/drafts"),
  });
  return (
    <>
      <div className="page-intro">
        <div>
          <h1>All your records</h1>
          <p>Your saved files and versions, processing history and editable account drafts.</p>
        </div>
      </div>
      {session.isPending ? (
        <p>Loading your workspace…</p>
      ) : !session.data?.user ? (
        <div className="panel">
          <p className="mb-4">Sign in to view your private records.</p>
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="tabs" aria-label="Record categories">
            {["Saved files", "Processing history", "Account drafts"].map((label) => (
              <button
                key={label}
                className={`tab ${section === label ? "active" : ""}`}
                aria-pressed={section === label}
                onClick={() => setSection(label)}
              >
                {label}
              </button>
            ))}
          </div>
          {section === "Saved files" ? (
            <FilesWorkspace embedded />
          ) : section === "Processing history" ? (
            <History embedded />
          ) : (
            <section className="panel overflow-auto">
              <h2 className="text-lg mb-4">Account drafts</h2>
              {drafts.isPending ? (
                <p>Loading drafts…</p>
              ) : drafts.error ? (
                <p role="alert" className="error">
                  {drafts.error.message}
                </p>
              ) : !drafts.data?.drafts.length ? (
                <p className="muted">No account drafts saved yet.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Size</th>
                      <th>Revision</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drafts.data.drafts.map((d) => (
                      <tr key={d.id}>
                        <td>{d.name}</td>
                        <td>{formatBytes(d.fileSize)}</td>
                        <td>{d.revision}</td>
                        <td>{new Date(d.updatedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <Button asChild variant="secondary" className="mt-4">
                <Link href="/tools/edit-pdf">Open editor to manage drafts</Link>
              </Button>
            </section>
          )}
        </>
      )}
    </>
  );
}
