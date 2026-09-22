import { createPdfToolkit } from "/security/index.js";
self.onmessage = async ({ data }) => {
  try {
    const toolkit = await createPdfToolkit({ wasmUrl: "/security/wasm/qpdf.wasm" });
    const bytes =
      data.action === "protect-pdf"
        ? await toolkit.lock(data.bytes, {
            userPassword: data.password,
            ownerPassword: data.owner,
            keyLength: 256,
          })
        : await toolkit.unlock(data.bytes, { password: data.password });
    self.postMessage({ bytes }, [bytes.buffer]);
  } catch {
    self.postMessage({
      error: "The PDF could not be processed. Check the password and document integrity.",
    });
  }
};
