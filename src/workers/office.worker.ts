import { validateOffice } from "@/lib/advanced/office-validation";
import { layoutPdf, htmlBlocks, type Block } from "@/lib/advanced/document-layout";
self.onmessage = async ({
  data,
}: {
  data: { bytes: Uint8Array; kind: "docx" | "xlsx"; sheet: string };
}) => {
  try {
    await validateOffice(data.bytes, data.kind);
    self.postMessage({ progress: 0.2 });
    let blocks: Block[] = [];
    if (data.kind === "docx") {
      const mammoth = await import("mammoth");
      blocks = htmlBlocks(
        (await mammoth.convertToHtml({ arrayBuffer: new Uint8Array(data.bytes).buffer })).value,
      );
    } else {
      const Excel = await import("exceljs");
      const book = new Excel.Workbook();
      await book.xlsx.load(new Uint8Array(data.bytes).buffer);
      const selected = data.sheet
        ? book.worksheets.filter((s) => s.name === data.sheet)
        : book.worksheets;
      if (!selected.length) throw new Error("Sheet name not found.");
      const rows: string[][] = [];
      let count = 0,
        characters = 0;
      for (const s of selected) {
        blocks.push({ kind: "paragraph", text: s.name, size: 20, bold: true });
        rows.length = 0;
        s.eachRow((row) => {
          if (++count > 10000 || row.cellCount > 100)
            throw new Error("Workbook exceeds 10,000 rows or 100 columns.");
          const values: string[] = [];
          row.eachCell({ includeEmpty: true }, (cell) => values.push(cell.text));
          const line = values.join(" | ");
          characters += line.length;
          if (characters > 2_000_000) throw new Error("Workbook exceeds 2 million characters.");
          rows.push(values);
        });
        blocks.push({ kind: "table", rows: [...rows] });
      }
    }
    self.postMessage({ progress: 0.6 });
    const result = await layoutPdf(blocks, data.kind === "xlsx");
    self.postMessage({ result });
  } catch (e) {
    self.postMessage({ error: e instanceof Error ? e.message : "Office conversion failed." });
  }
};
