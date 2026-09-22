import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { modifyPdf, inspectForms, type PdfOptions } from "@/lib/advanced/pdf";
import { textPdf, csv, escapeHtml } from "@/lib/advanced/conversion";
import { validateOffice } from "@/lib/advanced/office-validation";
const options: PdfOptions = {
  text: "",
  secondary: "",
  pages: "",
  size: 12,
  opacity: 0.3,
  flatten: false,
  fields: {},
  clear: false,
};
async function fixture() {
  const d = await PDFDocument.create();
  d.addPage();
  d.addPage();
  d.setTitle("Private title");
  return d.save();
}
describe("advanced PDF outputs", () => {
  it("writes and clears metadata without changing the input", async () => {
    const b = await fixture();
    const result = await modifyPdf(b, "metadata-pdf", {
      ...options,
      text: "New title",
      secondary: "Writer",
    });
    expect((await PDFDocument.load(result)).getTitle()).toBe("New title");
    expect((await PDFDocument.load(b)).getTitle()).toBe("Private title");
    const cleared = await modifyPdf(result, "metadata-pdf", { ...options, clear: true });
    expect((await PDFDocument.load(cleared, { updateMetadata: false })).getTitle()).toBe("");
  });
  it("creates, fills and flattens forms", async () => {
    const b = await modifyPdf(await fixture(), "pdf-forms", {
      ...options,
      text: "Full name",
      secondary: "Initial",
    });
    expect((await inspectForms(b))[0].value).toBe("Initial");
    const filled = await modifyPdf(b, "pdf-forms", {
      ...options,
      fields: { "Full name": "Changed" },
    });
    expect((await inspectForms(filled))[0].value).toBe("Changed");
    const flattened = await modifyPdf(filled, "pdf-forms", { ...options, flatten: true });
    expect(await inspectForms(flattened)).toHaveLength(0);
  });
  it("preserves pages and does not enlarge structural compression", async () => {
    const b = await fixture();
    for (const action of ["watermark-pdf", "header-footer", "page-numbers"] as const) {
      const out = await modifyPdf(b, action, { ...options, text: "Page {page}", pages: "2" });
      expect((await PDFDocument.load(out)).getPageCount()).toBe(2);
    }
    expect((await modifyPdf(b, "compress-pdf", options)).length).toBeLessThanOrEqual(b.length);
  });
  it("paginates text and reports unsupported glyphs", async () => {
    const out = await textPdf("Hello\n".repeat(200) + "你好");
    expect((await PDFDocument.load(out.bytes)).getPageCount()).toBeGreaterThan(1);
    expect(out.replacements).toBe(2);
  });
  it("escapes HTML and spreadsheet formula injection", () => {
    expect(escapeHtml('<script>"&')).toBe("&lt;script&gt;&quot;&amp;");
    expect(csv([["=SUM(A1)", 'hello,"world"']])).toBe('"\'=SUM(A1)","hello,""world"""');
  });
});
describe("Office archive validation", () => {
  async function archive(name = "word/document.xml", content = "<document>Hello</document>") {
    const z = new JSZip();
    z.file("[Content_Types].xml", "<Types/>");
    z.file(name, content);
    return z.generateAsync({ type: "uint8array" });
  }
  it("accepts a bounded document archive", async () => {
    expect(
      (await validateOffice(await archive(), "docx")).file("word/document.xml"),
    ).not.toBeNull();
  });
  it("rejects mismatched Office formats and macros", async () => {
    await expect(validateOffice(await archive(), "xlsx")).rejects.toThrow("not a valid");
    await expect(validateOffice(await archive("word/vbaProject.bin"), "docx")).rejects.toThrow(
      "Unsafe",
    );
  });
  it("rejects XML entity declarations before parsing", async () => {
    await expect(
      validateOffice(
        await archive(
          "word/document.xml",
          '<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]>',
        ),
        "docx",
      ),
    ).rejects.toThrow("entities");
  });
  it("rejects forged expanded sizes", async () => {
    const b = await archive();
    const v = new DataView(b.buffer);
    for (let i = 0; i < b.length - 24; i++)
      if (v.getUint32(i, true) === 0x02014b50) {
        v.setUint32(i + 24, 100_000_000, true);
        break;
      }
    await expect(validateOffice(b, "docx")).rejects.toThrow("oversized");
  });
});
