export const accents = [
  "emerald",
  "blue",
  "purple",
  "rose",
  "red",
  "orange",
  "teal",
  "gray",
] as const;
export type Accent = (typeof accents)[number];
export const accentLabels: Record<Accent, string> = {
  emerald: "Emerald",
  blue: "Blue",
  purple: "Purple",
  rose: "Rose",
  red: "Red",
  orange: "Orange",
  teal: "Teal",
  gray: "Gray",
};
export type Appearance = {
  theme: "light" | "dark" | "system" | "dim" | "oled" | "sepia";
  accent: Accent;
  buttonColor: string;
  contrast: boolean;
  colorfulHeader: boolean;
};
