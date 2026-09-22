"use client";
import dynamic from "next/dynamic";
import type { ToolDefinition } from "@/config/tools";
const Reader = dynamic(() => import("./reader").then((m) => m.PdfReader), {
  ssr: false,
  loading: () => <p className="muted my-8">Loading your PDF reader…</p>,
});
const Workbench = dynamic(() => import("./workbench").then((m) => m.PdfWorkbench), {
  ssr: false,
  loading: () => <p className="muted my-8">Loading your document workspace…</p>,
});
const Editor = dynamic(() => import("../editor/pdf-editor").then((m) => m.PdfEditor), {
  ssr: false,
  loading: () => <p className="muted my-8">Loading your PDF editor…</p>,
});
const Advanced = dynamic(() => import("../advanced/pdf-tools").then((m) => m.AdvancedPdf), {
  ssr: false,
});
const Ocr = dynamic(() => import("../advanced/ocr-tool").then((m) => m.OcrTool), { ssr: false });
const ImageStudio = dynamic(() => import("../advanced/image-studio").then((m) => m.ImageStudio), {
  ssr: false,
});
const Conversion = dynamic(() => import("../advanced/conversion").then((m) => m.Conversion), {
  ssr: false,
});
export function ToolClient({ tool }: { tool: ToolDefinition }) {
  if (tool.kind === "advanced-pdf") return <Advanced id={tool.id} />;
  if (tool.kind === "ocr") return <Ocr />;
  if (tool.kind === "image-studio") return <ImageStudio />;
  if (tool.kind === "conversion") return <Conversion id={tool.id} />;
  return tool.kind === "editor" ? (
    <Editor />
  ) : tool.kind === "reader" ? (
    <Reader />
  ) : (
    <Workbench tool={tool} />
  );
}
