import { describe, it, expect, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { htmlBlocks, layoutPdf } from "@/lib/advanced/document-layout";
import { draftSchema, validateDraftObjects } from "@/lib/validation/draft";
import { accountMessage, deliverAccountMail } from "@/server/services/mail";
import { modifyPdf, type PdfOptions } from "@/lib/advanced/pdf";
const options: PdfOptions = {
  text: "Consent",
  secondary: "true",
  pages: "",
  size: 12,
  opacity: 0.3,
  flatten: false,
  fields: {},
  clear: false,
};
describe("release functionality", () => {
  it("preserves semantic Word headings, tables and inline images without script content", () => {
    const blocks = htmlBlocks(
      '<h1>Report</h1><p>Hello <strong>team</strong><img src="data:image/png;base64,YQ=="></p><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table><script>steal()</script><img src="https://evil.example/a.png">',
    );
    expect(blocks).toEqual([
      { kind: "paragraph", text: "Report", size: 22, bold: true },
      { kind: "paragraph", text: "Hello team", size: 11, bold: true },
      { kind: "image", data: "data:image/png;base64,YQ==" },
      {
        kind: "table",
        rows: [
          ["A", "B"],
          ["1", "2"],
        ],
      },
    ]);
  });
  it("paginates long tables into a real landscape PDF", async () => {
    const result = await layoutPdf(
      [
        {
          kind: "table",
          rows: Array.from({ length: 150 }, (_, i) => [
            String(i),
            "A value that wraps into a readable cell",
          ]),
        },
      ],
      true,
    );
    const doc = await PDFDocument.load(result.bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(doc.getPage(0).getWidth()).toBe(842);
  });
  it("creates checkbox and dropdown form fields at explicit positions", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    const checked = await modifyPdf(bytes, "pdf-forms", {
      ...options,
      newField: {
        type: "checkbox",
        options: [],
        region: { page: 1, x: 10, y: 20, width: 5, height: 5 },
      },
    });
    expect((await PDFDocument.load(checked)).getForm().getCheckBox("Consent").isChecked()).toBe(
      true,
    );
    const dropdown = await modifyPdf(bytes, "pdf-forms", {
      ...options,
      secondary: "Yes",
      newField: { type: "dropdown", options: ["Yes", "No"] },
    });
    expect(
      (await PDFDocument.load(dropdown)).getForm().getDropdown("Consent").getSelected(),
    ).toEqual(["Yes"]);
  });
  it("rejects remote draft images, prototype fields and invalid page sizes", () => {
    expect(() => validateDraftObjects({ src: "https://evil.example/image.png" })).toThrow(
      "embedded",
    );
    expect(() => validateDraftObjects(JSON.parse('{"__proto__":{}}'))).toThrow("property");
    expect(() =>
      draftSchema.parse({
        name: "A",
        source: "YQ==",
        pages: [
          { id: "a", sourcePage: 0, rotation: 0, width: -1, height: 20, overlay: { objects: [] } },
        ],
      }),
    ).toThrow();
    expect(() => validateDraftObjects({ src: "data:image/png;base64,YQ==" })).not.toThrow();
  });
  it("does not claim mail delivery without configuration and rejects foreign reset links", async () => {
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_FROM", "");
    expect(
      await deliverAccountMail({
        to: "test@example.test",
        purpose: "reset",
        url: "http://localhost:3000/reset-password?token=fake",
      }),
    ).toBe(false);
    expect(() =>
      accountMessage({
        to: "test@example.test",
        purpose: "reset",
        url: "https://evil.example/reset-password?token=fake",
      }),
    ).toThrow("Invalid");
    vi.unstubAllEnvs();
  });
});
