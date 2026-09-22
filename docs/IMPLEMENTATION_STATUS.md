# Implementation status — 0.4.0

## Delivered scope

Phases 1–7 have working implementations across all 29 tool routes. Release 0.4 resolves the remaining cloud draft, file version, folder pagination, multilingual OCR, visual redaction/forms, richer image/Office, history and operational tooling work from the 0.3 handover. See [current release details](RELEASE_0_4.md) and [capability limits](CAPABILITIES.md).

Phase 8 includes Docker/Compose/Caddy deployment configuration, SMTP transport, shared PostgreSQL rate limits, health checks, cleanup scheduler, backup and restore verification. Live external deployment remains dependent on the owner's hosting, domain/DNS and SMTP configuration. No paid conversion API or desktop Office dependency is used.

## Current verification — 22 September 2026

- ESLint, strict TypeScript and production Webpack build: passed, including a rebuild after the final help/dashboard copy updates.
- Vitest: 55 tests passed across 8 files, including real isolated PostgreSQL/storage integration and local SMTP acceptance.
- Production dependency audit: zero known vulnerabilities reported.
- Cleanup command and formatting checks for the changed files: passed. Final overview/image workspace screenshots are in `docs/screenshots/`; no browser runtime errors were recorded during capture.
- Chromium: all 31 scenarios passed in one combined run. Coverage includes real exports, authentication/ownership, cloud draft revision conflicts, concurrent folder moves, drawing/redaction and WCAG serious/critical checks on overview/login/tools. WebKit: real three-page PDF merge smoke passed. The final dashboard update also passed a separate accessibility rerun. Firefox could not start even with an explicit existing profile directory; no Firefox pass is claimed.
- Docker: initial clean image build passed. Final-source image `docucore360:verified` also built successfully using the exact same lockfile/dependencies and a clean Next build cache. Compose example configuration validation and all three migrations against a fresh disposable container database passed. Final container health, landing route, registration, explicit private PDF save/download and account cleanup passed; Docker reported healthy. Test containers and their temporary data were removed afterward.
- Backup: SHA-256 manifest and actual restore into a disposable PostgreSQL database passed. A second exercise included a synthetic saved PDF, prior version and draft: 3 stored objects and 7 checksums verified, then the synthetic account was removed. This is not a production-scale recovery test.
- Bounded local health check: 50 requests, concurrency 5, zero failures; p50 15 ms and p95 659 ms while other verification was running. This is a smoke check, not production capacity testing.

Tests use synthetic documents/accounts. Download tests parse actual PDF/DOCX/XLSX/ZIP/image output. The local PostgreSQL cluster is dedicated to this project. Browser records are client-reported terminal metadata, not an active server queue.

## External configuration still needed

Hosting target, DNS/TLS activation, real SMTP delivery verification, offsite backup/retention and continuous production monitoring. The repository includes setup instructions in [DEPLOYMENT.md](DEPLOYMENT.md). Exact Office fidelity, general image inpainting, certificate signatures and universal mixed-script font shaping remain outside the implemented capability bounds; see the matrix rather than interpreting an active tool as lossless conversion.

## Local SMTP follow-up

Mailpit is configured on this development machine: SMTP `127.0.0.1:1025`, inbox `http://localhost:8025`, with loopback-only Docker port bindings and persistent local inbox storage. External email delivery remains unconfigured. The auth endpoint now reports configured mail requests correctly instead of always returning an unconfigured-mail notice.

Production build, lint and TypeScript passed. The opt-in Playwright email flow passed: actual verification/reset message delivery, browser link consumption, verified-email state, password replacement, old-session revocation, old-password rejection, single-use link rejection and matching forgot-password responses for registered/unregistered addresses. Synthetic account/messages were removed. Re-run with `LOCAL_MAIL_TEST=1 npx playwright test tests/e2e/specs/local-mail.spec.ts` only against the local SMTP setup.

## Personal profile follow-up

Added account photo upload/removal, full name, email, contact number, job title, location and bio. Sidebar identity now shows the signed-in user's name/photo with profile/settings/sign-out actions; the header photo links to `/profile`. Guests retain a sign-in entry. The profile supports mobile layouts and light/dark appearance.

Migration `20260922015057_user_profile` is additive. Photos are private, decoded with a 16-megapixel limit, limited to 2 MB and normalized to a 512×512 WebP without original metadata. Replacing/removing a photo removes the old storage object; account deletion removes the current photo. Backup verification includes avatars while supporting earlier backups without the avatar column.

Email changes require the current password, reject duplicate addresses, reset verification and revoke existing sessions and account tokens. Profile/contact values are never included in audit messages.

The high-level README and project description were rewritten. Detailed setup remains in `docs/DEVELOPMENT.md`. GitHub publication was not performed: this directory is not a Git checkout and the GitHub CLI is unauthenticated.

Profile follow-up verification: lint, TypeScript and final production build passed; all 55 existing unit/database tests passed. The final profile workflow and shared-shell accessibility checks passed (2 browser tests), including serious/critical WCAG checks on the profile and mobile overflow verification. Login/ownership and local email flows passed in a separate 3-test run after an earlier browser-startup timeout. The previous 3-object backup restored successfully with the updated verifier. Desktop/mobile profile screenshots are in `docs/screenshots/profile-desktop.png` and `docs/screenshots/profile-mobile.png`.

## Complete local regression recheck — 22 September 2026

The current app was rebuilt and restarted. ESLint, TypeScript, all 55 unit/database tests and the production build passed. Prisma reports all four migrations applied. The complete Chromium suite, with local email testing enabled, passed all 33 tests in one run (48.7 seconds). This includes profile/photo privacy, email changes, signup/login, reset/verification, editable drafts, document outputs, admin boundaries, accessibility and mobile navigation. App health and Mailpit both returned HTTP 200. No additional implementation fix was required during this recheck. Real Gmail delivery and external deployment remain unconfigured; this run does not expand the documented conversion or browser-support guarantees.

## Workspace appearance and account controls follow-up

Added a shared accessible show/hide control to every password field, photo edit/delete icons directly on the avatar, separate personal account security at `/profile/settings`, and workspace appearance plus View all records at `/settings`. Eight colour palettes work with light/dark/system modes; high contrast and colourful header/buttons are independent switches. Appearance previews persist locally and explicit saving persists account preferences for a fresh browser. Sidebar categories now follow URL state and back/forward navigation; All tools exposes all 29 routes. `/records` reuses owned files/versions and history alongside account drafts, retaining existing pagination and limits.

Migration `20260922111647_appearance_preferences` adds three preference columns and was applied locally (five migrations total). ESLint, TypeScript, the production build and all 55 unit/database tests passed. The complete Chromium suite passed all 36 scenarios with local mail enabled. New checks cover password visibility without accidental submission, password-change session revocation, category navigation, eight accent selections, fresh-browser preference restoration, records navigation, mobile overflow and serious/critical accessibility violations on the dark purple high-contrast settings screen. One initial test used an incorrect exact label selector for the theme dropdown; switching to its accessible combobox role resolved the test, and the combined suite passed. Updated synthetic profile screenshots and `appearance-dark-purple.png` are included.
