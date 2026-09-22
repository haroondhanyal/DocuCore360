import { cp, mkdir } from "node:fs/promises";
await mkdir("public/pdfjs", { recursive: true });
for (const file of ["build/pdf.worker.min.mjs", "cmaps", "standard_fonts", "wasm"]) {
  await cp(`node_modules/pdfjs-dist/${file}`, `public/pdfjs/${file.split("/").pop()}`, {
    recursive: true,
  });
}
