"use client";
import { useEffect, useState, useRef } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { usePreferences } from "@/stores/preferences";
import { api, type SessionUser } from "@/lib/api";
function AppearanceSync() {
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api<{ user: SessionUser | null }>("/api/auth/session"),
  });
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    const user = session.data?.user;
    if (!user) {
      loaded.current = null;
      return;
    }
    if (loaded.current === user.id) return;
    loaded.current = user.id;
    if (user.preference) usePreferences.getState().setAppearance(user.preference);
  }, [session.data]);
  return null;
}
function FavoriteSync() {
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api<{ user: SessionUser | null }>("/api/auth/session"),
  });
  const id = session.data?.user?.id;
  useEffect(() => {
    if (!id) return;
    let active = true;
    void api<{ favorites: string[] }>("/api/favorites")
      .then((data) => {
        if (active) usePreferences.setState({ favorites: data.favorites });
      })
      .catch(() => {});
    return () => {
      active = false;
      usePreferences.setState({ favorites: [] });
    };
  }, [id]);
  return null;
}
function Theme() {
  const theme = usePreferences((s) => s.theme);
  const accent = usePreferences((s) => s.accent);
  const contrast = usePreferences((s) => s.contrast);
  const colorfulHeader = usePreferences((s) => s.colorfulHeader);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = accent;
    root.classList.toggle("high-contrast", contrast);
    root.classList.toggle("colorful-header", colorfulHeader);
  }, [accent, contrast, colorfulHeader]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && media.matches),
      );
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  return null;
}
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <Theme />
      <FavoriteSync />
      <AppearanceSync />
      {children}
    </QueryClientProvider>
  );
}
