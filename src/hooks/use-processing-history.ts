"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { api, type SessionUser } from "@/lib/api";
import { findTool } from "@/config/tools";
export function useProcessingHistory() {
  const path = usePathname();
  const client = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api<{ user: SessionUser | null }>("/api/auth/session"),
  });
  return (inputName = "") => {
    const start = performance.now();
    let recorded = false;
    return (status: "COMPLETED" | "FAILED" | "CANCELLED", outputName?: string) => {
      if (recorded) return;
      recorded = true;
      const tool = findTool(path.split("/").pop() ?? "");
      if (!session.data?.user || !tool) return;
      void api("/api/history", {
        method: "POST",
        body: JSON.stringify({
          tool: tool.id,
          inputName: inputName.slice(0, 180),
          outputName: outputName?.slice(0, 180),
          durationMs: Math.min(86400000, Math.round(performance.now() - start)),
          success: status === "COMPLETED",
          status,
        }),
      })
        .then(() => client.invalidateQueries({ queryKey: ["history"] }))
        .catch(() => {});
    };
  };
}
