export type ToolKind =
  | "reader"
  | "merge"
  | "split"
  | "organize"
  | "image-to-pdf"
  | "pdf-to-image"
  | "editor"
  | "advanced-pdf"
  | "ocr"
  | "image-studio"
  | "conversion"
  | "planned";
export type ToolDefinition = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  route: string;
  acceptedFormats: string[];
  processingMode: "client" | "server";
  status: "stable" | "experimental" | "planned";
  kind: ToolKind;
  color: string;
  keywords: string;
};
function tool(
  id: string,
  name: string,
  description: string,
  category: string,
  icon: string,
  kind: ToolKind,
  color: string,
  keywords = "",
): ToolDefinition {
  return {
    id,
    name,
    description,
    category,
    icon,
    kind,
    color,
    keywords,
    route: `/tools/${id}`,
    acceptedFormats:
      kind === "image-to-pdf" || kind === "image-studio"
        ? [".jpg", ".jpeg", ".png", ".webp"]
        : kind === "ocr"
          ? [".pdf", ".jpg", ".jpeg", ".png", ".webp"]
          : id === "docx-to-pdf"
            ? [".docx"]
            : id === "xlsx-to-pdf"
              ? [".xlsx"]
              : id === "text-to-pdf"
                ? [".txt"]
                : id === "html-to-pdf"
                  ? [".html"]
                  : [".pdf"],
    processingMode: "client",
    status:
      kind === "planned"
        ? "planned"
        : ["ocr", "conversion", "image-studio"].includes(kind)
          ? "experimental"
          : "stable",
  };
}
export const tools: ToolDefinition[] = [
  tool(
    "merge-pdf",
    "Merge PDF",
    "Bring your PDFs together in one organized document.",
    "Organize PDF",
    "merge",
    "merge",
    "coral",
    "combine join",
  ),
  tool(
    "split-pdf",
    "Split PDF",
    "Separate a document into exactly the pages you need.",
    "Organize PDF",
    "split",
    "split",
    "orange",
    "extract ranges odd even",
  ),
  tool(
    "pdf-reader",
    "PDF Reader",
    "A clear, comfortable space to read your documents.",
    "Read & Edit",
    "book",
    "reader",
    "blue",
    "view search print",
  ),
  tool(
    "organize-pdf",
    "Organize PDF",
    "Reorder, rotate, duplicate and remove PDF pages.",
    "Organize PDF",
    "grid",
    "organize",
    "purple",
    "arrange delete extract blank crop",
  ),
  tool(
    "images-to-pdf",
    "Images to PDF",
    "Turn JPG, PNG and WebP images into a polished PDF.",
    "Convert",
    "image",
    "image-to-pdf",
    "green",
    "jpg jpeg png webp image to pdf",
  ),
  tool(
    "pdf-to-image",
    "PDF to Image",
    "Export crisp JPG, PNG or WebP images from a PDF.",
    "Convert",
    "images",
    "pdf-to-image",
    "amber",
    "pdf to jpg jpeg png webp",
  ),
  tool(
    "edit-pdf",
    "Edit PDF",
    "Add text, images and annotations to your document.",
    "Read & Edit",
    "pen",
    "editor",
    "blue",
    "editor text drawing",
  ),
  tool(
    "compress-pdf",
    "Compress PDF",
    "Make documents smaller and easier to share.",
    "Optimize",
    "compress",
    "advanced-pdf",
    "green",
    "reduce size optimize",
  ),
  tool(
    "sign-pdf",
    "Sign PDF",
    "Add your signature, your way.",
    "Security",
    "sign",
    "editor",
    "purple",
    "signature initials",
  ),
  tool(
    "ocr",
    "OCR Documents",
    "Make scanned text searchable and editable.",
    "OCR",
    "scan",
    "ocr",
    "blue",
    "scan recognize searchable",
  ),
  tool(
    "image-editor",
    "Image Editor",
    "Crop, adjust and create with an image workspace.",
    "Image Tools",
    "image",
    "image-studio",
    "coral",
    "resize filters rotate",
  ),
  tool(
    "docx-to-pdf",
    "Word to PDF",
    "Convert everyday Word documents into PDFs.",
    "Convert",
    "file",
    "conversion",
    "blue",
    "docx document word to pdf",
  ),
  tool(
    "pdf-to-docx",
    "PDF to Word",
    "Reconstruct PDF content as an editable document.",
    "Convert",
    "file",
    "conversion",
    "blue",
    "docx word",
  ),
  tool(
    "compress-image",
    "Compress Image",
    "Optimize your images with control over quality.",
    "Image Tools",
    "compress",
    "image-studio",
    "green",
    "reduce jpg png webp",
  ),
  tool(
    "protect-pdf",
    "Protect PDF",
    "Password protection with verified encryption support.",
    "Security",
    "lock",
    "advanced-pdf",
    "amber",
    "secure password encrypt",
  ),
  tool(
    "watermark-pdf",
    "Watermark PDF",
    "Add a text watermark to selected pages.",
    "Read & Edit",
    "file",
    "advanced-pdf",
    "blue",
  ),
  tool(
    "page-numbers",
    "Page Numbers",
    "Number selected pages with custom text.",
    "Read & Edit",
    "file",
    "advanced-pdf",
    "blue",
  ),
  tool(
    "header-footer",
    "Headers & Footers",
    "Add running headers and footers.",
    "Read & Edit",
    "file",
    "advanced-pdf",
    "blue",
  ),
  tool(
    "metadata-pdf",
    "PDF Metadata",
    "Edit title and author or clear descriptive metadata.",
    "Security",
    "file",
    "advanced-pdf",
    "blue",
  ),
  tool(
    "pdf-forms",
    "PDF Forms",
    "Fill, create and flatten AcroForm fields.",
    "Read & Edit",
    "file",
    "advanced-pdf",
    "blue",
  ),
  tool(
    "redact-pdf",
    "Redact PDF",
    "Permanently remove a region through raster reconstruction.",
    "Security",
    "file",
    "advanced-pdf",
    "blue",
  ),
  tool(
    "unlock-pdf",
    "Unlock PDF",
    "Remove encryption using a valid password.",
    "Security",
    "file",
    "advanced-pdf",
    "blue",
  ),
  tool(
    "xlsx-to-pdf",
    "Excel to PDF",
    "Paginate spreadsheet values into readable PDF tables.",
    "Convert",
    "file",
    "conversion",
    "blue",
  ),
  tool(
    "pdf-to-text",
    "PDF to Text",
    "Extract digital text from PDF pages.",
    "Convert",
    "file",
    "conversion",
    "blue",
  ),
  tool(
    "pdf-to-html",
    "PDF to HTML",
    "Export escaped PDF text as a simple HTML document.",
    "Convert",
    "file",
    "conversion",
    "blue",
  ),
  tool(
    "text-to-pdf",
    "Text to PDF",
    "Create a paginated PDF from plain text.",
    "Convert",
    "file",
    "conversion",
    "blue",
  ),
  tool(
    "html-to-pdf",
    "HTML to PDF",
    "Convert semantic HTML text into a simple PDF.",
    "Convert",
    "file",
    "conversion",
    "blue",
  ),
  tool(
    "pdf-tables",
    "PDF Tables",
    "Review detected table rows and export CSV or XLSX.",
    "Convert",
    "file",
    "conversion",
    "blue",
  ),
  tool(
    "compare-pdf",
    "Compare PDFs",
    "Compare extracted text and highlight changed lines.",
    "Read & Edit",
    "file",
    "conversion",
    "blue",
  ),
];
export const aliases: Record<string, string> = {
  "pdf-editor": "edit-pdf",
  "jpg-to-pdf": "images-to-pdf",
  "png-to-pdf": "images-to-pdf",
  "webp-to-pdf": "images-to-pdf",
  "image-to-pdf": "images-to-pdf",
  "pdf-to-jpg": "pdf-to-image",
  "pdf-to-png": "pdf-to-image",
  "pdf-to-webp": "pdf-to-image",
  "rotate-pdf": "organize-pdf",
  "extract-pages": "split-pdf",
  "delete-pages": "organize-pdf",
  "reorder-pages": "organize-pdf",
};
export function findTool(id: string) {
  return tools.find((t) => t.id === (aliases[id] ?? id));
}
export function searchTools(query: string) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return tools.filter((t) =>
    words.every((w) =>
      `${t.name} ${t.description} ${t.category} ${t.keywords}`.toLowerCase().includes(w),
    ),
  );
}

export const toolCategories = [
  "All tools",
  "PDF",
  "Ready to use",
  "Organize PDF",
  "Read & Edit",
  "Convert",
  "Image",
  "Security",
  "OCR",
] as const;
export function matchesToolCategory(tool: ToolDefinition, category: string) {
  if (category === "All tools") return true;
  if (category === "PDF") return tool.acceptedFormats.includes(".pdf") || tool.id.endsWith("-pdf");
  if (category === "Image") return tool.category === "Image Tools" || tool.id.includes("image");
  if (category === "Ready to use") return tool.status === "stable";
  return tool.category === category;
}
