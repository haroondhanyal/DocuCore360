export type OverlayJSON = { version?: string; objects: Record<string, unknown>[] };
export type EditorPage = {
  id: string;
  sourcePage: number | null;
  rotation: number;
  overlay: OverlayJSON;
  width: number;
  height: number;
};
export type SearchableAnnotation = {
  text: string;
  x: number;
  y: number;
  size: number;
  angle: number;
  family: "Helvetica" | "Times-Roman" | "Courier";
};
export type EditedPageExport = {
  sourcePage: number | null;
  rotation: number;
  overlay?: Uint8Array;
  text: SearchableAnnotation[];
};
export type EditorTool = "select" | "text" | "draw" | "existing";
