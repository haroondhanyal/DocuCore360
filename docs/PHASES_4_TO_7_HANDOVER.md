# DocuCore 360 — phases 4–7 handover

Historical 0.3 snapshot. Several gaps below are resolved in [release 0.4](RELEASE_0_4.md); use that document and the current capability matrix for present status.

Release: 0.3.0, 21 September 2026. This is a functional local implementation with explicitly bounded capabilities, not a claim of complete fidelity to every item in the original 100-feature brief.

## Delivered tools

| Area                   | Implemented                                                                                       | Limits                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| PDF enhancements       | Text watermark, page numbers, headers/footer, selected page ranges                                | Built-in Latin font; arbitrary rotated-page layouts need output review                                             |
| Forms                  | Inspect/fill text and checkbox/choice fields, create a text field, flatten AcroForms              | No XFA, rich-text fields, visual form designer or certificate signatures                                           |
| Metadata               | Edit title/author, clear document info and top-level XMP                                          | Does not scrub annotations or embedded content                                                                     |
| Compression            | Structural optimization; optional JPEG page reconstruction                                        | No guaranteed size reduction; lossy mode discards digital text/forms/links                                         |
| Permanent redaction    | Percentage-coordinate rectangle on one/all pages, fresh raster PDF                                | One rectangle per run; no drag-to-mark preview; entire output loses vector/text structure                          |
| Protection             | AES-256 encryption and valid-password decryption in local WASM worker                             | Encrypted results download only; private saved-file validation accepts unlocked PDFs                               |
| OCR                    | Local English recognition of images/PDFs, editable text, TXT/DOCX/searchable PDF                  | English only; approximate invisible Latin search layer; edits to extracted text do not alter PDF search positions  |
| Image studio           | Resize, percentage crop, rotate/flip, brightness/contrast/saturation/blur, text layers, undo/redo | No general drawing or selection/inpainting tools; first-image preview; identical settings applied to batch         |
| Image text replacement | OCR-detected lines become editable overlays with chosen background                                | Covers original pixels; does not reconstruct textures/fonts                                                        |
| Image conversion       | JPEG/PNG/WebP, quality settings, batch ZIP, actual sizes                                          | PNG encoder ignores lossy quality; output may be larger                                                            |
| Office conversion      | DOCX text→PDF; XLSX sheet values→paginated PDF; digital PDF text→DOCX                             | Text/value reconstruction only; images, original tables/layout/fonts/merged cells/charts are not preserved         |
| Text/HTML              | Text/HTML semantic text→PDF; PDF→TXT/escaped HTML                                                 | Built-in Latin PDF font replaces unsupported characters with an explicit count; HTML assets/scripts never rendered |
| PDF tables             | Heuristic row/position extraction, editable cells, CSV/XLSX export                                | One selected page; up to 200 detected rows; manual review required                                                 |
| Comparison             | Added/removed extracted text lines                                                                | Does not compare appearance, images or formatting                                                                  |

## Workspace and administration

- Explicit account file saving, including bounded DOCX/XLSX and UTF-8 text formats; files remain outside `public/`.
- Flat private folders: create, rename, delete, assign files; deletion leaves files unfiled.
- File favorites and cross-device signed-in tool favorites; browser favorites remain available to guests.
- Up to 20 immutable snapshots per file, download and restore. Snapshots preserve the current saved copy; exporting a new editor result still creates a separate asset.
- Open saved PDF in editor or saved image in image-to-PDF tool.
- Latest 1,000 saved records and latest 200 successful result records; history can be cleared. History currently records outputs rendered by the shared Result component, not every OCR/compare action or failed/cancelled attempt. It does not claim measured processing duration.
- Opt-in editable PDF draft with source bytes and annotations in IndexedDB. One draft per browser profile, manual save/restore/delete, debounced autosave. No automatic account/cloud draft synchronization. It can be read by another person using the same browser profile.
- Admin users list/search, role changes, disable/enable, session revocation, self-access guard and last-enabled-admin guard.
- Command center: real database/storage health, disk capacity, storage totals including snapshots, active sessions, top recorded tools and audit events. Manual expired-file/session/token cleanup.
- No server conversion queue is running: conversion jobs execute in browser workers. No simulated server-job metrics.

## Security and operational details

Office ZIP preflight rejects encryption, macros, embedded objects, traversal names, duplicate entries, unsupported methods, excessive counts/sizes/ratios, inconsistent local headers and XML entity declarations. Expanded entries are bounded before handing archives to Office parsers. Office parsing/PDF generation runs in a cancellable worker with a 60-second timeout.

PDF modification and password operations use cancellable workers. OCR uses Tesseract's worker; language/core assets are hosted locally. Raster image rendering uses browser canvas with pixel/page/output bounds. The encryption engine is `pdfstudio`/qpdf WASM; no desktop installation or paid conversion API is needed.

Migration `20260921002608_workspace_versions` adds account status, file favorites and version metadata; it does not drop prior data. File/account deletion removes snapshot binaries as well as originals.

## Remaining product scope and release gate

The four phases now have usable implementations, but the complete original brief still includes deeper features: multilingual OCR/Unicode PDF fonts, richer Office layout and table reconstruction, full image drawing/layer tools, visual multi-region redaction/form designer, nested folders/pagination, integrated editable cloud versions, complete processing history/job orchestration and cloud draft synchronization.

The single numbered phase after Phase 7 is **Phase 8: production release verification and deployment**. This requires deployment configuration, email delivery adapter/credentials, scheduler, backups and restore exercise, production TLS/domain, broader browser/accessibility/load testing, distributed rate limiting if deployed across multiple processes, and operational monitoring. These are not represented as complete by passing local tests. No external deployment or email account was configured.
