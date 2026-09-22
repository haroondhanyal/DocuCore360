"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Search, Star } from "lucide-react";
import { searchTools, matchesToolCategory, toolCategories } from "@/config/tools";
import { ToolCard } from "@/components/tool-card";
import { usePreferences } from "@/stores/preferences";
export function ToolDirectory({ favoritesOnly = false }: { favoritesOnly?: boolean }) {
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const router = useRouter();
  const requested = params.get("category");
  const filter = toolCategories.find((c) => c === requested) ?? "All tools";
  const favorites = usePreferences((s) => s.favorites);
  const result = searchTools(query).filter(
    (t) => (!favoritesOnly || favorites.includes(t.id)) && matchesToolCategory(t, filter),
  );
  return (
    <>
      <div className="page-intro">
        <div>
          <h1>
            {favoritesOnly
              ? "Your favorite tools"
              : filter === "All tools"
                ? "All tools"
                : `${filter} tools`}
          </h1>
          <p>
            {favoritesOnly
              ? "Your shortcuts, saved on this browser."
              : "Find your next time-saver. Available tools work entirely on your device."}
          </p>
        </div>
      </div>
      <div className="panel mb-6 flex items-center gap-3">
        <Search size={18} className="muted" />
        <input
          className="w-full !border-0 !p-0"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try “merge pdf” or “pdf image”"
          aria-label="Filter tools"
        />
      </div>
      <div className="tabs">
        {toolCategories.map((c) => (
          <button
            key={c}
            className={`tab ${filter === c ? "active" : ""}`}
            aria-pressed={filter === c}
            onClick={() =>
              router.push(
                `${favoritesOnly ? "/favorites" : "/tools"}${c === "All tools" ? "" : `?category=${encodeURIComponent(c)}`}`,
              )
            }
          >
            {c}
          </button>
        ))}
      </div>
      <p className="muted text-xs mb-4" role="status">
        {result.length} tools
      </p>
      <div className="tool-grid">
        {result.map((t) => (
          <ToolCard key={t.id} tool={t} />
        ))}
      </div>
      {!result.length && (
        <div className="panel empty-state">
          <Star size={28} />
          <strong>No tools here yet</strong>
          <p>
            {favoritesOnly
              ? "Star tools on the overview to add shortcuts here."
              : "Try a different search or category."}
          </p>
        </div>
      )}
    </>
  );
}
