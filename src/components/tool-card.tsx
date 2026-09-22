"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type SessionUser } from "@/lib/api";
import Link from "next/link";
import { Star } from "lucide-react";
import type { ToolDefinition } from "@/config/tools";
import { ToolIcon } from "@/components/tool-icon";
import { usePreferences } from "@/stores/preferences";
export function ToolCard({ tool }: { tool: ToolDefinition }) {
  const favorites = usePreferences((s) => s.favorites);
  const toggle = usePreferences((s) => s.toggleFavorite);
  const chosen = favorites.includes(tool.id);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api<{ user: SessionUser | null }>("/api/auth/session"),
  });
  async function favorite() {
    setError("");
    if (!session.data?.user) {
      toggle(tool.id);
      return;
    }
    setBusy(true);
    try {
      await api("/api/favorites", {
        method: "POST",
        body: JSON.stringify({ toolId: tool.id, favorite: !chosen }),
      });
      toggle(tool.id);
    } catch {
      setError("Could not save favorite. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="tool-card">
      <Link href={tool.route}>
        <span className={`tool-icon ${tool.color}`}>
          <ToolIcon name={tool.icon} />
        </span>
        <h3>{tool.name}</h3>
        <p>{tool.description}</p>
        {tool.status === "planned" && <span className="planned-label">COMING SOON</span>}
      </Link>
      <button
        className={`favorite ${chosen ? "chosen" : ""}`}
        aria-label={`${chosen ? "Unfavorite" : "Favorite"} ${tool.name}`}
        aria-pressed={chosen}
        disabled={busy}
        onClick={() => void favorite()}
      >
        <Star size={15} fill={chosen ? "currentColor" : "none"} />
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
