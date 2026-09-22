// Memory only: navigation to a tool never persists document bytes in browser storage.
let pending: File[] = [];
export function setPendingFiles(files: File[]) {
  pending = files;
}
export function takePendingFiles() {
  const files = pending;
  pending = [];
  return files;
}
