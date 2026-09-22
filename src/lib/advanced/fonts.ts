import type { PDFDocument } from "pdf-lib";
const paths = {
  latin: "NotoSans-Regular.ttf",
  arabic: "NotoSansArabic-Regular.ttf",
  devanagari: "NotoSansDevanagari-Regular.ttf",
};
export function fontScript(text: string) {
  return /[\u0600-\u08ff]/.test(text)
    ? "arabic"
    : /[\u0900-\u097f]/.test(text)
      ? "devanagari"
      : "latin";
}
export async function unicodeFont(
  doc: PDFDocument,
  script: keyof typeof paths,
  base = globalThis.location?.origin,
) {
  const { default: fontkit } = await import("@pdf-lib/fontkit");
  doc.registerFontkit(fontkit);
  const url = new URL(`/fonts/${paths[script]}`, base);
  const response = await fetch(url);
  if (!response.ok) throw new Error("Local PDF font could not be loaded.");
  return doc.embedFont(await response.arrayBuffer(), { subset: true });
}
