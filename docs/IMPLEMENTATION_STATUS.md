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

## Separate privacy/help and full workspace palettes

Privacy guidance now lives at `/privacy`; Help & resources remains at `/help` with tool instructions and troubleshooting. The sidebar privacy card and footer route to the dedicated privacy page. Settings now separates Workspace colour theme (eight palettes) from Display mode (light/dark/system), and palettes tint sidebar, background and panels as well as controls. High contrast retains its dedicated surfaces. README and the settings screenshot were updated.

Lint, TypeScript, production build and the three workspace Chromium scenarios passed. A separate browser check verified both navigation destinations and 16 distinct sidebar colour combinations across eight palettes in light/dark modes.

## Simplified appearance and personal identity

Settings now follows Display mode → Workspace colour → Button colour without duplicate swatch controls. System, Light, Dark, Dim, Midnight black and Sepia modes are available. Custom button colours persist locally and to the account, and select readable black/white text automatically. Profiles expose a unique editable handle and a sidebar subtitle choice: username, bio, job title or account role. Empty bio/title falls back to the username; account roles remain administrator-managed. The sixth migration, `20260922143000_profile_handles_button_colour`, backfills unique handles for existing users and adds saved subtitle/button preferences.

Verification: lint, TypeScript, production build, all 55 unit/database tests and all 37 Chromium scenarios passed. Browser coverage checks same-name registrations receive different handles, case-insensitive duplicate rejection, invalid handle validation, sidebar bio/role persistence without role escalation, all six display selections, custom button colour/text contrast, account persistence, reload and reset to matching workspace colours. Initial browser selectors were refined to distinguish profile text fields from similarly named dropdown options; the final complete suite passed in one run. Updated profile and settings screenshots are included.

## Complete automation framework — 23 September 2026

Added a separate Playwright/API, executable Cucumber BDD and native k6 framework, following the separation used in LedgerMate360. The inventory contains 400 functional scenarios: 352 Playwright/API cases (including the original 37 regression journeys) and 48 display-mode/palette BDD combinations. Matrix variants are explicit in the inventory. The 20 performance workloads and 55 unit/database tests are counted separately.

The complete local production-server run passed all 400 functional scenarios without skips or retries, all 20 k6 workloads and all 55 unit/database tests. Production build, ESLint and TypeScript passed. Playwright completed in 381 seconds and Cucumber in 33 seconds. Allure generated successfully with 475 passing checks, zero failures, broken results or skips. Performance workloads reported zero HTTP errors and 100% content checks; the highest workload p95 was 94.8 ms against the 1500 ms threshold. These short local workloads do not establish production capacity.

The document round-trip coverage exposed a text-to-PDF line-wrapping bug that split normal words across lines. Wrapping now prefers whitespace, retaining character splitting only for overlong tokens; DC-TEXT-005 verifies full paragraph extraction. Initial browser timing/selector issues were corrected, and an earlier interrupted run was superseded by the complete passing run. The runner handles stale macOS JAVA_HOME values and prevents idle sleep while running.

Combined HTML/JSON and Allure reports include separate layer counts, stage outcomes, source fingerprint and evidence. Browser cases retain screenshots, videos and traces locally; the checked-in snapshot omits raw attachments. See [automation setup](automation/README.md), [400-case inventory](automation/SCENARIOS.md) and [sanitized passing results](automation/latest/results.json). GitHub Actions is configured with PostgreSQL, Mailpit, Chromium, Java and k6; hosted CI execution is not part of this local verification claim.

## Allure branding, layer navigation and history

README product images now come from the current workspace and refreshed profile/settings browser journeys. Allure includes the DocuCore logo, executor Raja Haroon, QA Automation department, project/date/source metadata, UI/APIs/BDD/Performance/Unit suites and layer categories. Categories include passing results and are not defect totals. A dedicated k6 page lists all 20 workloads with metrics and raw result access. Native framework hooks and browser evidence are preserved, while API/k6 attachments show execution steps or measured thresholds.

History persists across complete local runs and is cached per branch in GitHub Actions, enabling real status, duration, retry and category trend charts. Hosted CI has an external blocker: GitHub run 35801756243 did not start any steps because the account is locked due to a billing issue. This account-level restriction requires the repository owner's billing action; local test success does not imply hosted CI success.

Final verification: all 400 functional scenarios, 20 k6 workloads and 55 unit/database tests passed with zero skips/failures; lint and TypeScript passed. Generated Allure suites/categories contain 261 UI, 91 APIs, 48 BDD, 20 Performance and 55 Unit / Database cases. An attachment audit confirmed screenshots/videos on every UI and BDD result and JSON execution evidence on every API/k6 result. Browser checks verified branding, the 475-check overview, k6 navigation and all 20 workload rows.

## Interactive performance reporting and official k6 timeline

Added persistent dark/light appearance, P95/P99/average comparison, slowest-first sorting, shared chart/table filters and a 20-row CSV export. Each native or Docker k6 execution now exports the official Grafana k6 HTML report with one-second aggregation and its HTTP listener disabled. The dashboard links to this actual time-series export and the dedicated performance Allure report.

A fresh complete run passed all 400 functional, 20 performance and 55 unit/database checks, plus lint and TypeScript. Browser verification covered theme persistence, P99 numeric ordering, shared filters, CSV contents, mobile overflow and native report navigation with no JavaScript errors. The native report rendered request-rate, latency, VU and transfer-rate charts. README and report screenshots were refreshed from this run. The known GitHub account billing lock remains external to local verification.

## Expanded ownership regression and native report branding

Added 20 API scenarios: 12 cross-account resource-access checks and eight folder-integrity transitions. Coverage verifies file/draft/version denial without changing owner data, folder listing/deletion isolation, duplicate creation, rename conflicts, self/descendant cycles, foreign parents, child retention on parent deletion and whitespace normalization. Functional inventory is now 420 cases (372 Playwright/API + 48 BDD), with 20 k6 workloads and 55 unit/database tests separate.

The official Grafana k6 export now includes a DocuCore logo, executor/department header and dashboard navigation while retaining native charts and original attribution. Report cleanup uses bounded retries for transient ENOTEMPTY errors. The LedgerMate reference was fetched and remained at commit 7f909ea; no unverified newer reference layout is claimed.

Verification on 23 September 2026: the focused 20-case expansion passed, followed by a complete run of 420 functional scenarios, 20 k6 workloads and 55 unit/database tests, with zero failures/skips. ESLint and TypeScript passed. Allure displayed 261 UI, 111 API, 48 BDD, 20 Performance and 55 Unit / Database results (495 total). Chromium verified the combined report count, dedicated k6 report, native DocuCore logo and dashboard return navigation without JavaScript errors. Screenshots and sanitized report snapshots were refreshed.
