export type PdfSource = { id: string; name: string; bytes: ArrayBuffer; count: number };
export type PageSpec = { id: string; sourceId: string | null; pageIndex: number; rotation: number };
export type ImageSource = {
  id: string;
  name: string;
  bytes: ArrayBuffer;
  type: "image/png" | "image/jpeg";
  width: number;
  height: number;
};
export type ImageOptions = {
  size: "a4" | "letter" | "original" | "custom";
  orientation: "portrait" | "landscape";
  margin: number;
  fit: "fit" | "fill";
  width: number;
  height: number;
};
export type Output = {
  bytes: Uint8Array;
  name: string;
  mime: string;
  notice?: string;
  saveable?: boolean;
  historyRecorded?: boolean;
};
export type PdfTask =
  | { kind: "organize"; sources: PdfSource[]; pages: PageSpec[]; name: string }
  | { kind: "split"; source: PdfSource; groups: number[][]; name: string }
  | { kind: "images"; images: ImageSource[]; options: ImageOptions };
