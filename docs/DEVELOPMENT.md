# Development setup and reference

**PDF, Image & Document Studio** — a private, original document workspace built with Next.js, React, TypeScript, PostgreSQL and Prisma.

Version 0.4.0 adds private cloud drafts, integrated file versions, nested folders, multilingual OCR, visual redaction/forms, richer image and Office tools, shared rate limits and deployment tooling. See the [release handover](RELEASE_0_4.md) and [deployment guide](DEPLOYMENT.md) for exact scope and setup.

## What works

- Responsive overview, sidebar, tool search, category filters, browser-local favorite tools and light/dark/system appearance.
- Register, login, logout, remembered sessions, profile updates, password change, account deletion and protected USER/ADMIN boundaries.
- Password reset and email verification with hashed single-use tokens and SMTP delivery. External SMTP credentials still need configuration.
- Explicit private file saving, persisted PostgreSQL metadata, local binary storage, file search/filter/sort, rename, download and deletion.
- PDF Reader: page rendering, lazy thumbnails, selectable text, document search, continuous/single/two-page viewing, zoom, fit, navigation, rotation, outline, metadata, fullscreen/presentation, print and download.
- Merge PDF with input reorder and individual page arrangement.
- Split PDF by selected pages, ranges, odd/even pages, every page or every N pages; multiple results are ZIP files.
- Organize PDF: drag-reorder, accessible arrow controls, selection/Shift-selection, rotate, duplicate, delete, keep selected pages, insert blank pages, import additional PDFs, undo and redo.
- Images to PDF: JPG/PNG/WebP, reorder, A4/Letter/original/custom dimensions, orientation, margins, fit/fill and quality.
- PDF to JPG/PNG/WebP: all or selected pages, resolution, quality, background transparency where supported, ZIP output.
- PDF editor: movable/resizable text and images, shapes, arrows, highlights, freehand drawing, whiteout, detected-text replacement overlays, stamps, visual signatures, object properties/layer ordering, page operations, undo/redo and PDF export.
- Real processing progress, cancellation, independent output files and download inspection tests.

## Verified release

See [implementation status](IMPLEMENTATION_STATUS.md) for current lint, TypeScript, build, unit/database, browser and operational verification results.

## Run on this machine

Local production preview: **http://localhost:3000**. For a restart, use `npm run build` followed by `npm start`, or the development command below.

The project has already been installed and an isolated PostgreSQL 16 cluster initialized under `.local-postgres/`, bound to `127.0.0.1:55432`. Its randomly generated password is in the ignored `.env` file. No existing database was modified.

```sh
# Only needed if the project's database has stopped:
npm run db:local:start

npm run dev
```

Open **http://localhost:3000**. Create your own account through Register; no shared demo password is shipped.

Stop the optional project database with `npm run db:local:stop`. These convenience scripts assume `pg_ctl` is on PATH and the existing project cluster is present. They are not needed when you use your own PostgreSQL service.

## Local reset/verification email

Run `npm run mail:local:start` with Docker Desktop running. Captured emails appear at **http://localhost:8025**; they are not sent to real inboxes. This machine's local SMTP settings are configured. See [local email setup](DEPLOYMENT.md#local-email-inbox-mailpit) for restart/configuration details.

## Fresh installation in VS Code

Prerequisites: Node.js 22.12+ (24 LTS recommended), npm, PostgreSQL 16+, VS Code and a modern browser. No Office, LibreOffice, Acrobat, Photoshop or paid conversion API is required. Check each locked dependency's engine requirement before using an older runtime.

```sh
npm ci
cp .env.example .env
# Configure DATABASE_URL and APP_URL in .env.
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

`postinstall` copies the exact installed PDF.js worker, fonts, character maps and WASM assets into `public/pdfjs/`. They are served locally; the app does not fetch document-processing assets from a third-party CDN. `npm ci` is preferred for reproducible dependency versions.

### PostgreSQL option A: existing local server

Create a dedicated role and database using your PostgreSQL administration tool or `psql`. Example commands (replace the example password before running):

```sql
CREATE ROLE docucore_app LOGIN PASSWORD 'replace-with-a-local-password' CREATEDB;
CREATE DATABASE docucore360 OWNER docucore_app;
```

`CREATEDB` is useful only for Prisma's development shadow database; production runtime roles should not have it. Set:

```dotenv
DATABASE_URL="postgresql://docucore_app:YOUR_URL_ENCODED_PASSWORD@localhost:5432/docucore360"
APP_URL="http://localhost:3000"
```

### PostgreSQL option B: optional Docker

Docker is not required. If preferred, run a PostgreSQL container with a persistent volume and your own password:

```sh
docker run --name docucore-postgres \
  -e POSTGRES_USER=docucore_app \
  -e POSTGRES_PASSWORD=replace-with-a-local-password \
  -e POSTGRES_DB=docucore360 \
  -p 127.0.0.1:5432:5432 \
  -v docucore_pg:/var/lib/postgresql/data \
  -d postgres:16
```

Then point `DATABASE_URL` at that container and apply migrations.

## Commands

| Command                    | Purpose                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| `npm run dev`              | Next.js development server                                           |
| `npm run build`            | Generate Prisma client and create production build                   |
| `npm start`                | Serve the production build                                           |
| `npm run lint`             | ESLint and React checks                                              |
| `npm run typecheck`        | Strict TypeScript checks                                             |
| `npm test`                 | Unit tests and PostgreSQL integration tests when DATABASE_URL is set |
| `npm run test:e2e`         | Playwright browser workflows against a production build              |
| `npm run db:migrate`       | Apply/create local development migrations                            |
| `npm run db:seed`          | Optional admin seed, with no default credentials                     |
| `npm run db:deploy`        | Apply production migrations                                          |
| `npm run storage:schedule` | Run periodic cleanup                                                 |
| `npm run backup`           | Consistent database/storage backup (requires quiesced writers)       |
| `npm run backup:verify`    | Verify checksums and restore into a disposable database              |
| `npm run storage:cleanup`  | Remove expired temporary files, sessions and account tokens          |

For browser testing, run `npx playwright install chromium` once and `npm run build` before `npm run test:e2e`. Browser tests create synthetic accounts and documents and clean up successful test accounts. Failure artifacts are ignored by Git. Failed test accounts can remain for diagnosis; never use production credentials in tests.

Next.js uses its supported Webpack compiler in this workspace because the sandbox prevents Turbopack from binding a helper port. No application functionality depends on that compiler choice.

## Environment variables

| Variable                      | Purpose                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `DATABASE_URL`                | PostgreSQL connection string; required for accounts and saved files                 |
| `APP_URL`                     | Exact application origin for same-origin write validation; include the correct port |
| `STORAGE_ROOT`                | Local file storage root, default `./storage`                                        |
| `TEMP_FILE_RETENTION_MINUTES` | Retention setting reserved for temporary server-processing flows                    |
| `MAX_UPLOAD_MB`               | Server upload cap, at most the current 25 MB application limit                      |
| `SEED_ADMIN_EMAIL`            | Optional email for the explicit admin seed                                          |
| `SEED_ADMIN_PASSWORD`         | Optional admin password, minimum 14 characters                                      |

No administrator is created without both seed values. Re-running seed does not reset an existing user's password or elevate an existing user's role.

## Architecture and directory structure

```text
src/app/                   Routes, public pages and authenticated REST handlers
src/components/ui/         shadcn-compatible Button/Dialog primitives
src/components/pdf/        Lazy-loaded reader and tool workbench
src/components/editor/     Fabric canvas, properties, signatures and PDF editor
src/components/upload/     Shared validated drag-and-drop input
src/config/tools.ts        Central capability and tool registry
src/lib/pdf/               Pure PDF operations and browser adapters
src/lib/security/          Password and token hashing
src/lib/validation/        File limits, signatures and safe naming
src/server/services/       Auth, file saving and account mail adapter
src/server/repositories/   Ownership-scoped persistence queries
src/server/storage/        Replaceable local storage adapter
src/workers/               Dedicated PDF processing worker
src/stores/                Browser preference state
prisma/                    Schema, checked-in migrations and opt-in seed
scripts/                   PDF asset setup and cleanup
tests/unit/                PDF and security boundary tests
tests/integration/         Real PostgreSQL/storage tests
tests/e2e/                 Playwright Page Objects, fixtures, utilities and specs
storage/                   Ignored upload/processed/temp binary data
docs/                      Architecture, capability matrix and implementation status
```

Detailed design: [Architecture](ARCHITECTURE.md), [Capabilities](CAPABILITIES.md), [Implementation status](IMPLEMENTATION_STATUS.md).

### Dependency decisions

| Package                                          | Why it is required                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| Next.js, React, React DOM                        | App Router, reusable UI and server APIs                                |
| TypeScript                                       | Strict shared application/worker types                                 |
| Tailwind CSS / PostCSS                           | Responsive design tokens and utility styling                           |
| Radix Dialog/Slot, CVA, clsx, tailwind-merge     | Accessible dialogs and composable shadcn-style primitives              |
| Lucide React                                     | Consistent original-interface iconography                              |
| Zustand                                          | Browser favorites and appearance preferences                           |
| TanStack Query                                   | Session and saved-file fetch/cache/invalidation                        |
| Prisma / Prisma Client / PostgreSQL adapter / pg | Typed database access, migrations and PostgreSQL connections           |
| pdfjs-dist                                       | PDF rendering, text extraction, outlines and metadata                  |
| Fabric.js                                        | Interactive editor objects, text, drawing and annotation serialization |
| Sharp                                            | Bounded server-side image decoding for saved-upload validation         |
| Prettier                                         | Consistent readable project formatting                                 |
| pdf-lib                                          | Actual page manipulation and PDF generation                            |
| JSZip                                            | Multiple-output ZIP packaging                                          |
| Zod                                              | Authentication, input and API validation                               |
| tsx / dotenv                                     | Typed local seed/cleanup scripts and environment loading               |
| Vitest / Playwright                              | Unit, database and browser output verification                         |
| ESLint / Next ESLint configuration               | Code quality and framework checks                                      |

Node's built-in crypto supplies scrypt and secure random tokens; no password-hashing service is used. Fabric.js is loaded only on editor pages. OCR, security and Office engines load only when their workflows need them. Transitive development overrides pin patched deepmerge-ts/mysql2 versions; update them alongside Prisma and re-run migration, build and audit checks.

## Security and privacy

- Passwords use salted scrypt. Random session tokens are SHA-256 hashed in PostgreSQL, expire, and use HttpOnly/SameSite cookies; Secure is enabled in production.
- Writes require the configured same origin. APIs validate session ownership on every asset operation; knowing a UUID does not grant access.
- Files are capped by streamed request size before multipart parsing, then checked by extension/MIME/signature. PDFs are parsed before saved metadata is committed.
- Server filenames are generated UUIDs with restricted paths. Files are outside `public/`, and downloads have private/no-store and noindex headers.
- On-device tool inputs are not sent to the server. Account uploads and save actions explicitly retain a server copy. Sensitive document text is not put in audit logs.
- Rate limiting uses atomic PostgreSQL counters across processes. The Docker package supplies persistent volumes, proxy request limits, TLS and a cleanup scheduler; multiple hosts need shared binary storage.
- Content security policy blocks arbitrary remote scripts and object embeds. Next.js currently uses inline/eval allowances; tighten these with nonces for a production deployment after verifying framework and PDF-worker compatibility.
- Schedule `npm run storage:cleanup`, for example every 10 minutes through your operating system or hosting scheduler. Current core tools create no temporary server documents. Saved files never receive an implicit temporary expiration.
- File deletion and database deletion are not a distributed transaction. Storage is deleted first so content is removed even if a later database write fails; a retry reconciles metadata. Backups and retention of backups must be configured by the deployment owner.
- Reset/verification tokens are hashed, expiring and single-use. Configure the SMTP environment variables before enabling account emails. Mail links are never printed to logs or exposed in public API responses.

## PDF and conversion limitations

PDF Reader supports valid-password opening, but structural editing of encrypted PDFs is unavailable. Viewing rotation does not rewrite an original PDF. Browser print support varies; downloading and printing from the browser's native PDF viewer is the fallback.

Merge/split/reorder copy page content, not every document-level structure. Outlines, form behavior, attachments, accessibility tagging and cryptographic signatures require dedicated advanced handling. Inspect important exports before use. Text search depends on the document's text layer; use the dedicated English OCR tool for scanned text. Complex font geometry may affect selection highlighting.

PDF-to-image is raster output and therefore cannot preserve selectable text. Resolution is approximated from PDF points (72 points per inch). Actual output size is reported from generated bytes; conversion is not a compression guarantee. Image-to-PDF uses 96 DPI for original pixel dimensions. At less than 100% quality images are normalized to JPEG on white; at 100%, PNG transparency can be retained. A4/Letter/custom canvas fill is centered and clipped to the configured margins.

Large document rendering is lazy, but input and output bytes still live in browser memory. Practical limits vary by device. Tool cancellation terminates the PDF manipulation worker; image export cancels active PDF rendering and checks cancellation between pages.

The PDF editor exports annotations as high-resolution transparent raster overlays. Added Latin text gets an approximate invisible searchable layer; unsupported script characters remain visible in the overlay. Text selection alignment, embedded-font fidelity and semantic structure are best effort. Existing text replacement masks old content and adds replacement text; the original text remains searchable underneath. Whiteout is not redaction. Visual signatures are not certificate-based digital signatures.

Editor state stays in memory unless you explicitly save a local or account draft. Account drafts support revision-checked save/restore and optional autosave. One editable IndexedDB draft can be restored after reload; it persists in this browser profile until deleted. Exported files flatten objects. Undo retains 20 local edit snapshots. Object/image insertion is bounded, and exported annotation resolution is approximately 144 DPI for ordinary pages.

Current capabilities and limits are documented in [the 0.4 handover](RELEASE_0_4.md). OCR includes seven languages; Office conversion reconstructs supported headings, tables and inline images, with best-effort layout. Permanent redaction rebuilds page images. Phase 8 deployment tooling is included; external hosting, DNS, SMTP credentials and ongoing monitoring require deployment configuration.
