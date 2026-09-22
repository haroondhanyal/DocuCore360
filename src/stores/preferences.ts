"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
type State = {
  favorites: string[];
  theme: "light" | "dark" | "system";
  toggleFavorite: (id: string) => void;
  setTheme: (theme: State["theme"]) => void;
};
export const usePreferences = create<State>()(
  persist(
    (set) => ({
      favorites: [],
      theme: "system",
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
