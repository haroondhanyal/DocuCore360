# DocuCore 360 — 0.4 release

This release completes the remaining implementation work identified after phases 4–7. All 29 tool routes have actual workflows. Phase 8 now includes a deployable package and local release checks; external hosting, DNS, SMTP credentials and ongoing production monitoring remain deployment-owner configuration.

## Added in this release

- Account PDF drafts: private source PDF plus editable annotations, explicit save/restore/delete, optional debounced autosave, optimistic revision checks and cross-session access. Up to 20 drafts per account; source PDF limit 25 MB and request limit 40 MB. Local IndexedDB drafts remain a separate opt-in feature.
- Export to a new saved file or a new version of an existing compatible file. Previous bytes are preserved, with up to 20 versions. Restoring a PDF updates its page count and rejects a stale concurrent replacement.
- Nested account folders, ownership/cycle checks and serialized mutations; saved-file search/filter/sort and server pagination of 50 records per page.
- OCR language choices: English, Urdu, Arabic, Hindi, Spanish, French and German. Language data and Noto font assets are served locally. Multiple images can be recognized together; PDF input remains one document per run.
- Multi-region drag-to-mark PDF redaction and visual placement of text, checkbox and dropdown form fields. Redaction rebuilds fresh page images; it removes source text structure rather than hiding it with an overlay.
- Image freehand drawing, rectangles/ellipses, image layers, text opacity/alignment/font controls, layer duplication/order, aspect lock, social size presets and grayscale/sepia/invert adjustments. OCR replacement masks retain the original detected text bounds.
- DOCX headings, tables and inline images reconstructed in PDF; XLSX values rendered as paginated tables. Unicode text PDF output uses local fonts for supported scripts. PDF comparison displays before/after text columns.
- Signed-in processing completion/failure/cancellation records and measured duration for the main tool flows. Browser-reported records populate administration metrics; this is not a server conversion queue. History contains metadata, not document contents.
- PostgreSQL-backed atomic rate limiting, real SMTP transport, health endpoint, periodic cleanup scheduler, Docker/Compose/Caddy configuration, checksum backups and disposable-database restore verification.

## Operational setup

Follow [DEPLOYMENT.md](DEPLOYMENT.md). SMTP is implemented but no external provider has been configured in this workspace. Local SMTP delivery is tested with synthetic messages to a local catcher. No message was sent to a real recipient.

The migrations are additive. `20260921083418_cloud_drafts_nested_folders_limits` adds account drafts, nested-folder parents and shared rate-limit buckets. Storage stays outside `public/`; draft JSON includes source bytes and is stored as a private file, not a database blob.

## Deliberate capability limits

- PDF editing is overlay editing. Whiteout/text replacement preserves the old underlying content; use the separate raster redaction workflow for removal. Visual signatures are not certificate signatures.
- Office conversion is best effort. Complex Word pagination, spreadsheet charts/merged-cell formatting and exact source typography are not reproduced. PDF-to-Word extracts text; it does not reconstruct the original page layout and images.
- OCR needs review. Search geometry is approximate, recognition can be wrong, and mixed-script font shaping is not guaranteed. Editing extracted text does not recompute original OCR word positions.
- AcroForms do not support XFA or certificate signatures. Visual field placement rejects rotated source pages.
- Image overlays and drawing are bounded browser-canvas operations; there is no Photoshop-style selection/inpainting engine. Batch export applies the same edits to each input. Rotation and overlay positioning should be reviewed before export.
- Comparison detects extracted text changes, not visual or image changes. Table extraction remains heuristic with editable cells.
- Binary storage uses a local persistent volume. Multiple app hosts need shared storage. PostgreSQL limits work across processes, but the supplied Compose package is a single-host deployment.
- The cleanup scheduler removes expired operational records; it does not silently expire saved files or drafts. Backups need an external retention/offsite policy.

See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for exact test evidence. Passing local checks does not establish production capacity or complete fidelity to every advanced item in the original brief.
