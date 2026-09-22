"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, Star } from "lucide-react";
import { searchTools } from "@/config/tools";
import { ToolCard } from "@/components/tool-card";
import { usePreferences } from "@/stores/preferences";
export function ToolDirectory({ favoritesOnly = false }: { favoritesOnly?: boolean }) {
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(params.get("category") ?? "All tools");
  const favorites = usePreferences((s) => s.favorites);
  const result = searchTools(query).filter(
    (t) =>
      (!favoritesOnly || favorites.includes(t.id)) &&
      (filter === "All tools" ||
        (filter === "PDF"
          ? t.id.includes("pdf") || t.kind === "reader"
          : filter === "Image"
            ? t.category === "Image Tools" || t.id.includes("image")
            : filter === "Ready to use"
              ? t.status === "stable"
              : t.category === filter)),
  );
  return (
    <>
      <div className="page-intro">
        <div>
          <h1>{favoritesOnly ? "Your favorite tools" : "A tool for every document."}</h1>
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
        {[
          "All tools",
          "Ready to use",
          "Organize PDF",
          "Read & Edit",
          "Convert",
          "Image",
          "Security",
          "OCR",
        ].map((c) => (
          <button
            key={c}
            className={`tab ${filter === c ? "active" : ""}`}
            onClick={() => setFilter(c)}
          >
            {c}
          </button>
        ))}
      </div>
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
