"use client";
import type { Appearance } from "@/config/appearance";
import { create } from "zustand";
import { persist } from "zustand/middleware";
type State = Appearance & {
  favorites: string[];
  theme: "light" | "dark" | "system";
  setAppearance: (values: Partial<Appearance>) => void;
  toggleFavorite: (id: string) => void;
  setTheme: (theme: State["theme"]) => void;
};
export const usePreferences = create<State>()(
  persist(
    (set) => ({
      favorites: [],
      theme: "system",
      accent: "emerald",
      contrast: false,
      colorfulHeader: false,
      setAppearance: (values) => set(values),
      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id)
            ? s.favorites.filter((x) => x !== id)
            : [...s.favorites, id],
        })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "docucore-preferences" },
  ),
);
