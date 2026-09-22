"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Monitor,
  FolderOpen,
  LockKeyhole,
  Sparkles,
  Check,
} from "lucide-react";
import { tools } from "@/config/tools";
import { ToolCard } from "@/components/tool-card";
import { Dropzone } from "@/components/upload/dropzone";
import { setPendingFiles } from "@/lib/pending-file";
import { usePreferences } from "@/stores/preferences";
import { useQuery } from "@tanstack/react-query";
import { api, type SessionUser } from "@/lib/api";
export function Dashboard() {
  const router = useRouter();
  const [category, setCategory] = useState("Popular tools");
  const favorites = usePreferences((s) => s.favorites);
  const { data } = useQuery({
    queryKey: ["session"],
    queryFn: () => api<{ user: SessionUser | null }>("/api/auth/session"),
  });
  const categories = ["Popular tools", "Organize PDF", "Convert", "Read & Edit", "Favorites"];
  const shown =
    category === "Popular tools"
      ? tools.slice(0, 6)
      : category === "Favorites"
        ? tools.filter((t) => favorites.includes(t.id))
        : tools.filter((t) => t.category === category);
  return (
    <>
      <div className="page-intro">
        <div>
          <h1>
            {data?.user
              ? `Welcome back, ${data.user.name.split(" ")[0]}`
              : "A good day to get things done."}
            <span className="text-[#b9a270]"> ✦</span>
          </h1>
          <p>Your documents, a little more organized. Your day, a little easier.</p>
        </div>
        <span className="date-label">YOUR EVERYDAY DOCUMENT WORKSPACE</span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="status-dot" />
            ALL YOUR DOCUMENTS. ONE WORKSPACE.
          </span>
          <h2>
            Less paperwork.
            <br />
            <em>More possibility.</em>
          </h2>
          <p>
            Everything you need to work with documents.
            <br />
            Read, organize and convert your files in one thoughtful workspace.
          </p>
          <div className="hero-tags">
            <span>
              <ShieldCheck size={13} />
              Private by design
            </span>
            <span>
              <Zap size={13} />
              No installation
            </span>
            <span>
              <Check size={13} />
              Free core tools
            </span>
          </div>
        </div>
        <div className="hero-drop">
          <Dropzone
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            multiple
            onFiles={(files) => {
              const pdfs = files.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
              if (pdfs.length && pdfs.length !== files.length)
                throw new Error("Choose PDFs or images together, rather than mixing formats.");
              setPendingFiles(files);
              router.push(
                pdfs.length
                  ? pdfs.length > 1
                    ? "/tools/merge-pdf"
                    : "/tools/pdf-reader"
                  : "/tools/images-to-pdf",
              );
            }}
          />
        </div>
      </section>
      <div className="section-head">
        <div>
          <h2>The right tool for every task</h2>
          <p>Small tasks. Big time-savers.</p>
        </div>
        <Link href="/tools">
          Explore all tools <ArrowRight size={14} />
        </Link>
      </div>
      <div className="tabs" role="tablist" aria-label="Tool categories">
        {categories.map((c) => (
          <button
            role="tab"
            aria-selected={category === c}
            className={`tab ${category === c ? "active" : ""}`}
            key={c}
            onClick={() => setCategory(c)}
          >
            {c}
            {c === "Popular tools" && <span className="tab-count">6</span>}
          </button>
        ))}
      </div>
      <div className="tool-grid">
        {shown.map((t) => (
          <ToolCard key={t.id} tool={t} />
        ))}
      </div>
      {!shown.length && (
        <div className="panel empty-state">
          <Sparkles size={25} />
          <strong>Your shortcuts start here</strong>
          <p>Tap the star on a tool to keep it close at hand.</p>
        </div>
      )}
      <div className="lower-grid">
        <section className="panel">
          <div className="panel-title">
            <h2>A home for your documents</h2>
            <Link href="/files">
              My files <ArrowUpRight size={12} className="inline" />
            </Link>
          </div>
          <div className="empty-state">
            <FolderOpen size={34} strokeWidth={1.2} />
            <strong>
              {data?.user
                ? "Save the files you want to keep"
                : "Your workspace is ready when you are"}
            </strong>
            <p>
              Files stay on your device while you use our core tools. Sign in and choose Save to My
              Files to keep a copy.
            </p>
            <Link
              href={data?.user ? "/files" : "/register"}
              className="text-xs text-[var(--primary)] mt-2"
            >
              {data?.user ? "Open my files" : "Create your free workspace"}{" "}
              <ArrowRight className="inline" size={12} />
            </Link>
          </div>
        </section>
        <section className="panel">
          <div className="panel-title">
            <h2>Made for your peace of mind</h2>
          </div>
          <div className="why-item">
            <LockKeyhole size={17} />
            <div>
              <strong>Private stays private</strong>
              <p>Your core PDF tasks run on your device.</p>
            </div>
          </div>
          <div className="why-item">
            <Monitor size={17} />
            <div>
              <strong>Right here in your browser</strong>
              <p>No downloads. No extra apps. Just get started.</p>
            </div>
          </div>
          <div className="why-item">
            <Sparkles size={17} />
            <div>
              <strong>Simple, from start to finish</strong>
              <p>Choose a file. Make it yours. Keep moving.</p>
            </div>
          </div>
        </section>
      </div>
      <div className="format-row">
        <span>A familiar home for your everyday formats</span>
        <div className="formats">
          {["PDF", "JPG", "PNG", "WEBP", "DOCX", "XLSX"].map((f) => (
            <span className="format" key={f}>
              {f}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
