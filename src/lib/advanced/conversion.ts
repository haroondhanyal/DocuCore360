import { unicodeFont, fontScript } from "./fonts";
import { PDFDocument, StandardFonts } from "pdf-lib";
export async function textPdf(text: string) {
  if (text.length > 2_000_000) throw new Error("Text exceeds 2 million characters.");
  const doc = await PDFDocument.create();
  const font =
    /[^\x00-\xff]/.test(text) && typeof location !== "undefined"
      ? await unicodeFont(doc, fontScript(text))
      : await doc.embedFont(StandardFonts.Helvetica);
  let page = doc.addPage(),
    y = page.getHeight() - 45;
  let replacements = 0;
  const safe = Array.from(text)
    .map((c) => {
      if (c === "\n" || c === "\t" || c === "\r") return c;
      try {
        font.encodeText(c);
        return c;
      } catch {
        replacements++;
        return "?";
      }
    })
    .join("");
  const line = (t: string) => {
    if (y < 45) {
      if (doc.getPageCount() >= 500) throw new Error("PDF exceeds 500 pages.");
      page = doc.addPage();
      y = page.getHeight() - 45;
    }
    page.drawText(t, { x: 40, y, size: 11, font });
    y -= 16;
  };
  for (const para of safe.replaceAll("\r", "").split("\n")) {
    let current = "";
    for (const c of para.replaceAll("\t", "    ")) {
      if (font.widthOfTextAtSize(current + c, 11) > page.getWidth() - 80) {
        if (/\s/.test(c)) {
          line(current.trimEnd());
          current = "";
        } else {
          const space = current.lastIndexOf(" ");
          if (space > 0) {
            line(current.slice(0, space));
            current = current.slice(space + 1) + c;
          } else {
            // A token wider than the page still needs a character boundary.
            line(current);
            current = c;
          }
        }
      } else current += c;
    }
    line(current);
  }
  return { bytes: await doc.save(), replacements };
}
export function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
export function csv(rows: string[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const safe = /^[\s]*[=+@-]/.test(value) ? "'" + value : value;
          return '"' + safe.replaceAll('"', '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
}
