"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatBytes, message } from "@/lib/utils";
import { Button } from "@/components/ui/button";
type Data = {
  users: { id: string; name: string; email: string; role: string; disabled: boolean }[];
  totalUsers: number;
  stats: { files: number; storageBytes: number; versions: number; activeSessions: number };
  health: {
    database: boolean;
    storageWritable: boolean;
    freeBytes: number | null;
    emailDelivery: boolean;
    checkedAt: string;
    processing: string;
  };
  jobs: { id: string; tool: string; status: string; progress: number }[];
  history: { tool: string; _count: number }[];
  audits: { id: string; action: string; createdAt: string }[];
};
export function Admin({ command = false }: { command?: boolean }) {
  const query = useQuery({
    queryKey: ["admin"],
    queryFn: () => api<Data>("/api/admin"),
    refetchInterval: 30000,
  });
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  async function action(body: unknown) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ result?: { files: number; sessions: number; tokens: number } }>(
        "/api/admin",
        { method: "POST", body: JSON.stringify(body) },
      );
      setStatus(
        result.result
          ? `Cleanup: ${result.result.files} files, ${result.result.sessions} expired sessions, ${result.result.tokens} expired tokens removed.`
          : "Access updated.",
      );
      await client.invalidateQueries({ queryKey: ["admin"] });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const data = query.data;
  return (
    <div className="form-stack">
      <div className="page-intro">
        <div>
          <h1>{command ? "Command center" : "Administration"}</h1>
          <p>Live database and storage information. Refreshes every 30 seconds.</p>
        </div>
        <Button
          variant="secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Refresh
        </Button>
      </div>
      {(error || query.error) && (
        <p className="error" role="alert">
          {error || query.error?.message}
        </p>
      )}
      {status && (
        <p role="status" className="notice">
          {status}
        </p>
      )}
      {!data ? (
        <p>Loading operational data…</p>
      ) : (
        <>
          <div className="stats-grid">
            {Object.entries({
              Users: data.totalUsers,
              "Saved files": data.stats.files,
              "Stored bytes": formatBytes(data.stats.storageBytes),
              "Active sessions": data.stats.activeSessions,
            }).map(([k, v]) => (
              <div className="panel stat" key={k}>
                <small>{k}</small>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          {command ? (
            <>
              <section className="panel form-stack">
                <h2>Service health</h2>
                <p>Database: {data.health.database ? "Connected" : "Unavailable"}</p>
                <p>
                  Storage: {data.health.storageWritable ? "Readable / writable" : "Unavailable"}
                </p>
                <p>
                  Disk available:{" "}
                  {data.health.freeBytes === null ? "Unknown" : formatBytes(data.health.freeBytes)}
                </p>
                <p>
                  Email delivery: {data.health.emailDelivery ? "SMTP configured" : "not configured"}
                </p>
                <p>{data.health.processing}</p>
                <p>Checked: {new Date(data.health.checkedAt).toLocaleString()}</p>
                <Button disabled={busy} onClick={() => void action({ action: "cleanup" })}>
                  Clean expired files and sessions
                </Button>
              </section>
              <section className="panel">
                <h2>Browser processing records</h2>
                {data.jobs.length ? (
                  data.jobs.map((j) => (
                    <p key={j.id}>
                      {j.tool}: {j.status} ({j.progress}%)
                    </p>
                  ))
                ) : (
                  <p>No server jobs. Local browser tools do not create server conversion jobs.</p>
                )}
              </section>
            </>
          ) : (
            <section className="panel overflow-auto">
              <h2>Users</h2>
              <input
                className="field"
                aria-label="Search users"
                placeholder="Search latest 200 users"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Access</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users
                    .filter((u) =>
                      `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((u) => (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td>
                          <select
                            aria-label={`Role for ${u.email}`}
                            value={u.role}
                            disabled={busy}
                            onChange={(e) => {
                              if (window.confirm(`Change ${u.email} to ${e.target.value}?`))
                                void action({ action: "user", id: u.id, role: e.target.value });
                            }}
                          >
                            <option>USER</option>
                            <option>ADMIN</option>
                          </select>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(`${u.disabled ? "Enable" : "Disable"} ${u.email}?`)
                              )
                                void action({ action: "user", id: u.id, disabled: !u.disabled });
                            }}
                          >
                            {u.disabled ? "Enable" : "Disable"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
          )}
          <div className="panel">
            <h2>Recorded tool results</h2>
            {data.history.length ? (
              data.history.map((h) => (
                <p key={h.tool}>
                  {h.tool}: {h._count}
                </p>
              ))
            ) : (
              <p>No signed-in result activity yet.</p>
            )}
          </div>
          <div className="panel">
            <h2>Recent audit events</h2>
            {data.audits.map((a) => (
              <p key={a.id}>
                {new Date(a.createdAt).toLocaleString()} · {a.action}
              </p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
