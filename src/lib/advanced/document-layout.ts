import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { parseDocument } from "htmlparser2";
import type { AnyNode, Element } from "domhandler";
import { unicodeFont, fontScript } from "./fonts";
export type Block =
  | { kind: "paragraph"; text: string; size?: number; bold?: boolean }
  | { kind: "table"; rows: string[][] }
  | { kind: "image"; data: string };
function text(node: AnyNode): string {
  if (node.type === "text") return node.data;
  if ("children" in node) return node.children.map(text).join("");
  return "";
}
export function htmlBlocks(html: string): Block[] {
  if (html.length > 30_000_000) throw new Error("Document HTML exceeds 30 MB.");
  const result: Block[] = [];
  const walk = (nodes: AnyNode[]) => {
    for (const node of nodes) {
      if (node.type === "text") {
        if (node.data.trim()) result.push({ kind: "paragraph", text: node.data });
        continue;
      }
      if (node.type !== "tag") continue;
      const el = node as Element;
      if (["script", "style", "iframe", "object", "svg", "math"].includes(el.name)) continue;
      if (el.name === "table") {
        const rows: string[][] = [];
        const find = (children: AnyNode[]) => {
          for (const n of children)
            if (n.type === "tag") {
              if (n.name === "tr")
                rows.push(
                  n.children
                    .filter((c) => c.type === "tag" && ["td", "th"].includes(c.name))
                    .map(text),
                );
              else find(n.children);
            }
        };
        find(el.children);
        result.push({ kind: "table", rows });
      } else if (el.name === "img") {
        if (/^data:image\/(png|jpeg);base64,/.test(el.attribs.src ?? ""))
          result.push({ kind: "image", data: el.attribs.src });
      } else if (["p", "h1", "h2", "h3", "h4", "li", "blockquote"].includes(el.name)) {
        const content = text(el).trim();
        if (content)
          result.push({
            kind: "paragraph",
            text: (el.name === "li" ? "• " : "") + content,
            size: el.name === "h1" ? 22 : el.name === "h2" ? 18 : el.name === "h3" ? 15 : 11,
            bold:
              el.name.startsWith("h") ||
              el.children.some((n) => n.type === "tag" && n.name === "strong"),
          });
        const images = (children: AnyNode[]) => {
          for (const n of children)
            if (n.type === "tag") {
              if (n.name === "img") walk([n]);
              else images(n.children);
            }
        };
        images(el.children);
      } else walk(el.children);
    }
  };
  walk(parseDocument(html, { decodeEntities: true }).children);
  if (result.length > 20000) throw new Error("Too many document blocks.");
  return result;
}
export async function layoutPdf(blocks: Block[], landscape = false) {
  const doc = await PDFDocument.create();
  const normal = await doc.embedFont(StandardFonts.Helvetica),
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const extra = new Map<string, PDFFont>();
  let replacements = 0;
  const allText = blocks
    .map((b) =>
      b.kind === "paragraph" ? b.text : b.kind === "table" ? b.rows.flat().join(" ") : "",
    )
    .join("\n");
  if (allText.length > 2_000_000) throw new Error("Document exceeds 2 million characters.");
  if (typeof location !== "undefined") {
    for (const script of ["latin", "arabic", "devanagari"] as const) {
      const needed =
        script === "arabic"
          ? /[\u0600-\u08ff]/.test(allText)
          : script === "devanagari"
            ? /[\u0900-\u097f]/.test(allText)
            : /[^\x00-\xff]/.test(allText);
      if (needed) extra.set(script, await unicodeFont(doc, script));
    }
  }
  let page = doc.addPage(landscape ? [842, 595] : [595, 842]),
    y = page.getHeight() - 40;
  const width = page.getWidth() - 80;
  function newPage() {
    if (doc.getPageCount() >= 500) throw new Error("Output exceeds 500 pages.");
    page = doc.addPage(landscape ? [842, 595] : [595, 842]);
    y = page.getHeight() - 40;
  }
  function space(h: number) {
    if (y - h < 40) newPage();
  }
  function fontFor(value: string, strong = false) {
    return extra.get(fontScript(value)) ?? (strong ? bold : normal);
  }
  function safe(value: string, font: PDFFont) {
    return Array.from(value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ""))
      .map((c) => {
        try {
          font.encodeText(c);
          return c;
        } catch {
          replacements++;
          return "?";
        }
      })
      .join("");
  }
  function wrap(value: string, font: PDFFont, size: number, w: number) {
    const lines: string[] = [];
    let current = "";
    for (const char of safe(value, font)) {
      if (char === "\n" || font.widthOfTextAtSize(current + char, size) > w) {
        lines.push(current);
        current = char === "\n" ? "" : char;
      } else current += char;
    }
    lines.push(current);
    return lines;
  }
  for (const block of blocks) {
    if (block.kind === "paragraph") {
      const font = fontFor(block.text, block.bold),
        size = block.size ?? 11;
      for (const line of wrap(block.text, font, size, width)) {
        space(size * 1.45);
        page.drawText(line, { x: 40, y: y - size, size, font });
        y -= size * 1.45;
      }
      y -= 8;
    } else if (block.kind === "image") {
      const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(block.data);
      if (!match) continue;
      const raw = atob(match[2]);
      if (raw.length > 8 * 1024 * 1024) throw new Error("Embedded image exceeds 8 MB.");
      const data = Uint8Array.from(raw, (c) => c.charCodeAt(0));
      const image = match[1] === "png" ? await doc.embedPng(data) : await doc.embedJpg(data);
      if (image.width * image.height > 40_000_000)
        throw new Error("Embedded image exceeds 40 megapixels.");
      const scale = Math.min(1, width / image.width, (page.getHeight() - 100) / image.height);
      const h = image.height * scale;
      space(h + 12);
      page.drawImage(image, { x: 40, y: y - h, width: image.width * scale, height: h });
      y -= h + 12;
    } else {
      if (block.rows.length > 10000) throw new Error("Table exceeds 10,000 rows.");
      const columns = Math.max(1, ...block.rows.map((r) => r.length));
      if (columns > 100) throw new Error("Table exceeds 100 columns.");
      const cellWidth = width / columns,
        size = columns > 10 ? 7 : 10;
      for (let index = 0; index < block.rows.length; index++) {
        const row = block.rows[index];
        const cells = Array.from({ length: columns }, (_, c) => {
          const value = row[c] ?? "",
            font = fontFor(value, index === 0);
          return { font, lines: wrap(value, font, size, Math.max(3, cellWidth - 8)) };
        });
        const lineCount = Math.max(...cells.map((c) => c.lines.length));
        let offset = 0;
        while (offset < lineCount) {
          space(size + 12);
          const available = Math.max(1, Math.floor((y - 40 - 8) / (size * 1.35)));
          const count = Math.min(lineCount - offset, available),
            height = count * size * 1.35 + 8;
          for (let col = 0; col < columns; col++) {
            const x = 40 + col * cellWidth;
            page.drawRectangle({
              x,
              y: y - height,
              width: cellWidth,
              height,
              borderWidth: 0.4,
              borderColor: rgb(0.65, 0.7, 0.72),
              color: index === 0 ? rgb(0.92, 0.96, 0.94) : rgb(1, 1, 1),
            });
            const cell = cells[col];
            for (let i = 0; i < count; i++) {
              const line = cell.lines[offset + i];
              if (line)
                page.drawText(line, {
                  x: x + 4,
                  y: y - 4 - size - i * size * 1.35,
                  size,
                  font: cell.font,
                });
            }
          }
          y -= height;
          offset += count;
          if (offset < lineCount) newPage();
        }
      }
      y -= 12;
    }
  }
  return { bytes: await doc.save(), replacements };
}
