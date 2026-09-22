import { mkdir, copyFile, readdir } from "node:fs/promises";
await mkdir("public/ocr/core", { recursive: true });
await copyFile("node_modules/tesseract.js/dist/worker.min.js", "public/ocr/worker.min.js");
for (const name of await readdir("node_modules/tesseract.js-core"))
  if (/\.wasm(\.js)?$/.test(name))
    await copyFile(`node_modules/tesseract.js-core/${name}`, `public/ocr/core/${name}`);
for (const language of ["eng", "urd", "ara", "hin", "spa", "fra", "deu"]) {
  await copyFile(
    `node_modules/@tesseract.js-data/${language}/4.0.0/${language}.traineddata.gz`,
    `public/ocr/${language}.traineddata.gz`,
  );
}
