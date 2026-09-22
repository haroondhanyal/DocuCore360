"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type SessionUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
export function History() {
  const [error, setError] = useState("");
  const client = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api<{ user: SessionUser | null }>("/api/auth/session"),
  });
  const history = useQuery({
    queryKey: ["history", session.data?.user?.id],
    queryFn: () =>
      api<{
        history: {
          id: string;
          tool: string;
          inputName: string;
          outputName: string | null;
          createdAt: string;
          success: boolean;
          durationMs: number;
        }[];
      }>("/api/history"),
    enabled: Boolean(session.data?.user),
  });
  return (
    <>
      <div className="page-intro">
        <div>
          <h1>Processing history</h1>
          <p>Signed-in result activity. Document contents are not recorded here.</p>
        </div>
        <Button
          variant="secondary"
          disabled={!history.data?.history.length}
          onClick={async () => {
            if (!window.confirm("Clear all recorded history?")) return;
            try {
              await api("/api/history", { method: "DELETE" });
              await client.invalidateQueries({ queryKey: ["history"] });
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Clear history
        </Button>
      </div>
      {(error || history.error) && <p className="error">{error || history.error?.message}</p>}
      <div className="panel overflow-auto">
        {!session.data?.user ? (
          <p>Sign in to view history. Guest activity is not retained.</p>
        ) : !history.data?.history.length ? (
          <p>No recorded results yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tool</th>
                <th>Result</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {history.data.history.map((h) => (
                <tr key={h.id}>
                  <td>{h.tool}</td>
                  <td>{h.outputName ?? h.inputName}</td>
                  <td>{h.success ? "Completed" : "Failed / cancelled"}</td>
                  <td>{(h.durationMs / 1000).toFixed(1)} s</td>
                  <td>{new Date(h.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
