# DocuCore 360 architecture

## Scope and phase boundaries

This iteration implements Phase 1 (foundation), Phase 2 (core PDF), and the subsequently authorized Phase 3 (PDF editor). Image editing, OCR, compression, Office conversion and operational administration remain visibly planned. A successful build does not imply these later capabilities are available.

## Application layers

- Next.js App Router, React and TypeScript provide public pages and authenticated APIs.
- Tailwind and shadcn-compatible accessible UI primitives provide the design system.
- A central tool registry drives navigation, search, capabilities and page metadata.
- PDF.js renders and extracts text in a local web worker. pdf-lib creates output documents. PDF processing is on-device; source documents are never overwritten.
- Zustand holds local tool favorites; TanStack Query manages session and server file state.
- REST handlers validate requests, enforce same-origin writes, sessions and ownership. Services contain authentication/storage rules; repositories isolate database queries.
- Prisma + PostgreSQL persist users, hashed sessions, files, folders, jobs, preferences, history, subscriptions and audit metadata. File binaries live under storage/, outside public/.

## Privacy and trust boundaries

Guest PDF tools keep file bytes in browser memory. Saving a file is an explicit authenticated action. Upload validation checks extension, MIME, signatures, byte limits and safe generated storage paths. Local storage is hidden behind an adapter for future object storage. Original files and outputs are distinct. Temporary assets have expiry and a scheduled cleanup command; deployments must schedule it.

## Authentication

Passwords use Node scrypt with independent random salts. Session tokens are random, hashed at rest, HttpOnly, SameSite=Lax and Secure in production. State-changing routes verify Origin. Login/register/reset and other bounded APIs use atomic PostgreSQL rate-limit buckets shared across processes. Reset and verification tokens are single-use, hashed and expiring; mail delivery uses Nodemailer SMTP, disabled until configured. No tokens are exposed by public API responses.

## Processing limitations

PDF edits in Phase 2 change page structure only. Encrypted inputs can be viewed with a valid password; structural editing of encrypted documents is rejected. Manipulation of signed PDFs invalidates existing cryptographic signatures. Image-to-PDF accepts JPEG, PNG and WebP, normalizing WebP through browser Canvas. Rendering and exporting large PDFs are bounded by browser memory. Output exports must be opened and inspected by tests; success is never inferred from a progress timer.

## Verification

Each phase runs lint, typecheck, unit tests and build. Integration coverage uses an isolated local PostgreSQL database. Playwright covers tool workflows, real file export and access controls. README and implementation status record verified checks and limitations.

## PDF editor

Fabric.js is lazy-loaded for document editing. Each page has a local JSON annotation layer, dimensions and a reference to the unchanged source PDF page. Twenty immutable history snapshots support undo/redo. A separate worker copies pages and embeds rendered transparent overlays. Added supported Latin text gets an approximate invisible searchable layer. Page coordinate mapping accounts for rotation and CropBox offsets. Existing-text overlays mask the original; they do not remove content. No redaction or certificate-signature claim is made.

## Phase 4–7 additions (0.3.0)

`src/lib/advanced/` contains PDF operations, raster reconstruction, OCR, Office ZIP validation and conversion helpers. `src/components/advanced/` supplies lazy-loaded workflows. Advanced PDF and Office processing have dedicated Web Workers with termination and timeouts; qpdf runs from same-origin static ES modules/WASM copied by postinstall. Tesseract worker/core/English trained data are also local assets. Generated vendor assets are ignored by lint/version control and restored by postinstall.

Workspace endpoints enforce user ownership before folder assignments, snapshot access and restoration. `FileVersion` stores paths/metadata only. `User.disabled` gates existing sessions and new session issuance; administrator changes revoke affected sessions. Admin health is measured from PostgreSQL/filesystem calls, not synthetic job statistics.

The editor's optional IndexedDB draft is intentionally separate from server My Files. One local browser-profile record holds a structured-cloned source ArrayBuffer and annotation JSON. It is not cross-device or account-isolated storage; the UI discloses that before enabling persistence.

## Release 0.4 additions

Private editable drafts store source PDF/overlay JSON in binary storage with revision-checked metadata in PostgreSQL. Folder mutations serialize on the owner row to prevent concurrent cycles. Export replacement preserves previous bytes as a version. Main browser workflows report terminal processing metadata and duration; no server conversion queue is implied. See [release notes](RELEASE_0_4.md) and [deployment operations](DEPLOYMENT.md).
