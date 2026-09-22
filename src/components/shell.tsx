"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Grid2X2,
  Image,
  ArrowLeftRight,
  ScanText,
  Minimize2,
  Signature,
  ShieldCheck,
  Clock3,
  Star,
  FolderOpen,
  History,
  Settings2,
  CircleHelp,
  Search,
  Menu,
  X,
  ArrowUpRight,
  ChevronRight,
  FileStack,
} from "lucide-react";
import { api, type SessionUser } from "@/lib/api";
import { searchTools, tools } from "@/config/tools";
import { ToolIcon } from "@/components/tool-icon";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/profile-avatar";
import { cn } from "@/lib/utils";
const main = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "All tools", href: "/tools", icon: Grid2X2 },
  { label: "PDF tools", href: "/tools?category=PDF", icon: FileStack },
  { label: "Image tools", href: "/tools?category=Image", icon: Image },
  { label: "Convert", href: "/tools?category=Convert", icon: ArrowLeftRight },
  { label: "OCR", href: "/tools/ocr", icon: ScanText },
  { label: "Compress", href: "/tools/compress-pdf", icon: Minimize2 },
  { label: "Sign & protect", href: "/tools?category=Security", icon: Signature },
];
const workspace = [
  { label: "My files", href: "/files", icon: FolderOpen },
  { label: "Recent files", href: "/recent", icon: Clock3 },
  { label: "Favorites", href: "/favorites", icon: Star },
  { label: "History", href: "/history", icon: History },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const client = useQueryClient();
  const router = useRouter();
  const [profileError, setProfileError] = useState("");
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState("");
  const { data } = useQuery({
    queryKey: ["session"],
    queryFn: () => api<{ user: SessionUser | null }>("/api/auth/session"),
  });
  function links(items: typeof main) {
    return items.map((item) => (
      <Link
        key={item.label}
        href={item.href}
        onClick={() => setMobile(false)}
        className={cn("nav-link", path === item.href && "active")}
      >
        <item.icon size={18} />
        <span>{item.label}</span>
        {item.label === "All tools" && <span className="nav-count">{tools.length}</span>}
      </Link>
    ));
  }
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {mobile && (
        <button
          className="sidebar-scrim"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={cn("sidebar", mobile && "is-open")}>
        <Link href="/" className="brand">
          <span className="brand-icon">
            <FileStack size={23} />
          </span>
          <span>
            DocuCore<span className="brand-360">360</span>
          </span>
        </Link>
        <button className="mobile-close" onClick={() => setMobile(false)} aria-label="Close menu">
          <X size={20} />
        </button>
        {data?.user ? (
          <details
            className="workspace-menu"
            onKeyDown={(e) => {
              if (e.key === "Escape") e.currentTarget.open = false;
            }}
          >
            <summary className="workspace-switch" aria-label="Open your profile menu">
              <ProfileAvatar user={data.user} />
              <span className="workspace-identity">
                <strong>{data.user.name}</strong>
                <small>Personal workspace</small>
              </span>
              <ChevronRight size={14} />
            </summary>
            <div className="workspace-menu-content">
              <p className="muted text-xs profile-email">{data.user.email}</p>
              <Link
                href="/profile"
                onClick={(e) => {
                  e.currentTarget.closest("details")?.removeAttribute("open");
                  setMobile(false);
                }}
              >
                View & edit profile
              </Link>
              <Link
                href="/settings"
                onClick={(e) => {
                  e.currentTarget.closest("details")?.removeAttribute("open");
                  setMobile(false);
                }}
              >
                Account settings
              </Link>
              <button
                onClick={async () => {
                  try {
                    await api("/api/auth/logout", { method: "POST" });
                    client.clear();
                    setMobile(false);
                    router.push("/login");
                    router.refresh();
                  } catch {
                    setProfileError("Unable to sign out. Please try again.");
                  }
                }}
              >
                Sign out
              </button>
              {profileError && (
                <p className="error" role="alert">
                  {profileError}
                </p>
              )}
            </div>
          </details>
        ) : (
          <Link href="/login" className="workspace-switch" onClick={() => setMobile(false)}>
            <span className="workspace-avatar">P</span>
            <span>
              <strong>Personal workspace</strong>
              <small>Sign in to make it yours</small>
            </span>
          </Link>
        )}
        <nav aria-label="Main navigation">
          <p className="nav-heading">WORKSPACE</p>
          {links(main)}
          <p className="nav-heading mt-7">YOUR LIBRARY</p>
          {links(workspace)}
          {data?.user?.role === "ADMIN" &&
            links([
              { label: "Administration", href: "/admin", icon: ShieldCheck },
              { label: "Command center", href: "/command-center", icon: Settings2 },
            ])}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <ShieldCheck size={22} />
            <strong>Your files. Your control.</strong>
            <p>Core PDF tools run right in your browser.</p>
            <Link href="/help">
              Our privacy approach <ArrowUpRight size={14} />
            </Link>
          </div>
          {links([
            { label: "Settings", href: "/settings", icon: Settings2 },
            { label: "Help & resources", href: "/help", icon: CircleHelp },
          ])}
          <div className="sidebar-foot">
            <span className="status-dot" />
            Workspace <span>v0.4</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setMobile(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <span>
              {path === "/"
                ? "Overview"
                : path.startsWith("/tools/")
                  ? "Document tools"
                  : path.split("/")[1]?.replaceAll("-", " ")}
            </span>
          </div>
          <div className="global-search">
            <Search size={17} />
            <input
              aria-label="Search all tools"
              placeholder="Search for a tool…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
              }}
            />
            <kbd>⌕</kbd>
            {query && (
              <div className="search-results">
                {searchTools(query).map((t) => (
                  <Link onClick={() => setQuery("")} key={t.id} href={t.route}>
                    <ToolIcon name={t.icon} size={19} />
                    <span>{t.name}</span>
                    {t.status === "planned" && <small>Planned</small>}
                  </Link>
                ))}
                {!searchTools(query).length && <p>No tools match “{query}”.</p>}
              </div>
            )}
          </div>
          <span className="local-badge">
            <span className="status-dot" />
            Privacy first
          </span>
          {data?.user ? (
            <Link href="/profile" aria-label="Your profile" title={data.user.name}>
              <ProfileAvatar user={data.user} />
            </Link>
          ) : (
            <Button asChild variant="secondary" size="sm">
              <Link href="/login">
                Sign in <ArrowUpRight size={14} />
              </Link>
            </Button>
          )}
        </header>
        <main id="main-content" className="content">
          {children}
        </main>
        <footer className="footer">
          <span>© {new Date().getFullYear()} DocuCore 360</span>
          <span>A little less paperwork. A lot more possibility.</span>
          <Link href="/help">
            Privacy & help <ArrowUpRight size={12} />
          </Link>
        </footer>
      </div>
    </div>
  );
}
