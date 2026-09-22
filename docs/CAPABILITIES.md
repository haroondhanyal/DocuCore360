# Capability matrix — 0.4.0

| Capability                                             | Status                         | Main limit                                                                         |
| ------------------------------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------- |
| Authentication, private files, settings                | Implemented                    | External SMTP credentials required for account email                               |
| Core PDF reader/merge/split/organizer/image conversion | Implemented                    | Document-level structures may not survive page copying                             |
| PDF editor and visual signatures                       | Best effort                    | Flattened overlays; text replacement is not permanent redaction                    |
| Watermarks/numbers/headers/metadata                    | Implemented                    | Built-in Latin font; metadata reset is not a full privacy scrub                    |
| AcroForms                                              | Best effort                    | Visual text/checkbox/dropdown placement; no XFA or rotated-page placement          |
| PDF compression                                        | Best effort                    | Savings not guaranteed; raster mode discards digital structure                     |
| Permanent redaction                                    | Implemented with limits        | Multiple visual regions; raster reconstruction loses vector/text structure         |
| AES-256 protection/unlock                              | Implemented                    | Correct password required; encrypted results download only                         |
| OCR/searchable PDF                                     | Best effort                    | Seven local language packs; recognition and search geometry require review         |
| Image studio/batch conversion                          | Implemented with limits        | Drawing, shapes, image/text layers; no advanced selection/inpainting               |
| OCR image text replacement                             | Best effort                    | Background-color mask and overlay, not texture reconstruction                      |
| DOCX/XLSX→PDF and PDF→DOCX                             | Best effort                    | Word headings/tables/inline images and sheet values; PDF-to-Word text extraction   |
| PDF tables→CSV/XLSX                                    | Experimental                   | Heuristic rows/cells, selected page, manual review                                 |
| HTML/TXT→PDF; PDF→HTML/TXT                             | Best effort                    | Inert semantic HTML; local fonts for supported scripts, not universal typography   |
| PDF comparison                                         | Best effort                    | Side-by-side extracted text differences only                                       |
| Private folders, favorites, versions                   | Implemented                    | Nested folders; 50-record pagination; 20 versions per asset                        |
| Signed-in tool favorites                               | Implemented                    | Guest favorites remain browser-local                                               |
| Processing history                                     | Implemented for main workflows | Client-reported terminal records/duration, latest 200; not an active server queue  |
| Editable draft/autosave                                | Implemented                    | One local draft plus up to 20 private account drafts; explicit initial save        |
| Admin and command center                               | Implemented                    | Actual metrics and browser processing records, no server conversion queue          |
| SMTP/shared limits/scheduler/backups                   | Implemented                    | Credentials, scheduling on non-Compose hosts and backup policy need operator setup |
| Docker/TLS deployment package                          | Included                       | External hosting/domain/DNS and production monitoring not configured               |

See [release handover](RELEASE_0_4.md) for precise behavior and [implementation status](IMPLEMENTATION_STATUS.md) for verification. Active tools produce actual output bytes; experimental does not mean simulated.

Personal profiles now include private photo upload/removal, name, contact number, bio, job title and location. Email changes require password confirmation and invalidate prior sessions/tokens. Sidebar and header avatars open the account profile.

Workspace appearance includes eight palettes (Emerald, Blue, Purple, Rose, Red, Orange, Teal and Gray), light/dark/system modes, high contrast and optional colourful header/buttons. Preview is browser-local; explicit Save appearance persists to the account. Personal password/deletion settings are at `/profile/settings`; workspace appearance and View all records are at `/settings`. The records view combines existing owned files/versions, latest 200 processing records and account drafts. All password fields have show/hide controls. Photo edit/delete icons sit directly on the profile avatar. Tool category navigation is URL-driven, including browser back/forward.
