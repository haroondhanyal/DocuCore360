# Deployment and operations

## Single-host Docker deployment

Requirements: Docker with Compose, a server reachable on ports 80/443, and a hostname whose DNS points to that server. No external deployment has been performed from this workspace.

1. Copy `deploy/.env.example` to `deploy/.env` on the server. Set a long random alphanumeric `POSTGRES_PASSWORD`, `DOMAIN` and matching HTTPS `APP_URL`. Keep this file private. Configure SMTP values if account email is needed.
2. Build and start from the repository root:

   ```sh
   docker compose --env-file deploy/.env -f deploy/compose.yaml up --build -d
   ```

3. Compose starts PostgreSQL, applies migrations, starts the application and cleanup scheduler, then Caddy obtains TLS for the configured hostname. Database, private storage and Caddy state use persistent volumes. The app runs as the unprivileged `node` user.
4. Verify `/api/health`, register a test account, explicitly save/download/delete a synthetic PDF, and exercise password reset with the configured SMTP provider. Inspect service logs and configure external uptime/storage alerts.
5. For an administrator, set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in the private environment file and run `docker compose --env-file deploy/.env -f deploy/compose.yaml run --rm app npm run db:seed`. No default administrator password exists. The seed does not promote an existing ordinary account.

`APP_ENV_FILE` can override the service environment-file path (relative to `deploy/`). The example configuration is validated without contacting external services. Do not expose PostgreSQL directly to the Internet. Back up persistent volumes before changing deployments; `down -v` deletes them.

## Email

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, and optional `SMTP_USER`/`SMTP_PASSWORD`. Use `SMTP_SECURE=true` for implicit TLS (typically port 465), or false with STARTTLS (typically 587). STARTTLS is required unless the local-test-only `SMTP_ALLOW_INSECURE=true` is explicitly set. Keep that option false in production.

Reset and verification links use `APP_URL`. Tokens are hashed, expiring and single-use; links/passwords are not logged. SMTP configuration alone does not prove delivery: verify recipient acceptance and provider/domain deliverability after deployment.

## Migrations, cleanup and health

- `npm run db:deploy`: apply checked-in migrations, without creating development migrations.
- `npm run storage:cleanup`: one cleanup pass.
- `npm run storage:schedule`: cleanup every minute until SIGINT/SIGTERM. Compose runs this as a separate service.
- `/api/health`: database query plus storage read/write access check; returns 503 on failure without exposing internals.
- Shared request counters live in PostgreSQL and expired buckets are removed by cleanup.

Do not run tests against production. Unit/database/browser tests create and remove synthetic records and expect local settings.

## Consistent backup and restore exercise

The supplied host scripts require compatible PostgreSQL client tools (`pg_dump`, `pg_restore`) and an environment pointing at the database and matching storage directory. They are intended to run where the storage volume is mounted. The app Docker image does not include PostgreSQL client utilities; use a maintenance host/container with those tools when backing up Compose volumes.

1. Stop application and scheduler writers; leave PostgreSQL running. Quiesce all other writers too.
2. Run `npm run backup -- --quiesced`. This creates a private timestamped directory under `backups/` (or `BACKUP_ROOT`), containing a custom-format database dump, storage copy and SHA-256 manifest.
3. Restart application/scheduler after the backup completes.
4. Run `npm run backup:verify -- backups/TIMESTAMP`. This validates checksums, restores into a random temporary database, verifies referenced storage paths and removes only that temporary database. The verification role needs permission to create/drop databases; the production runtime role does not need it.

A restore exercise passed locally with a synthetic saved PDF, prior version and private draft (3 stored objects and 7 checksums). This verifies the storage/database pairing for that fixture, not a production-scale library. For recovery, restore both the database dump and its matching storage tree into an isolated destination, validate them, then switch the deployment. Do not restore over a live database.

Encrypt and copy backups off-host, restrict access, choose retention and perform periodic populated-data restore exercises. These operational policies depend on the deployment owner and are not automated by this repository.

## Local email inbox (Mailpit)

The development machine uses a local Mailpit inbox. Start Docker Desktop, then run `npm run mail:local:start`. Open **http://localhost:8025** to see captured reset and verification emails. The application stays at **http://localhost:3000**.

Local `.env` settings:

```dotenv
SMTP_HOST="127.0.0.1"
SMTP_PORT="1025"
SMTP_FROM="DocuCore 360 <noreply@docucore.test>"
SMTP_SECURE="false"
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_ALLOW_INSECURE="true"
```

Restart the app after changing `.env`. This configuration captures mail locally; it does **not** deliver to Gmail or other external inboxes. Both ports bind to loopback only. Messages remain in the `docucore360-local-mail` Compose volume until deleted in the inbox. Use `npm run mail:local:stop` to stop it without deleting messages. Never use these development SMTP settings for production.

The service uses the [official Mailpit Docker image](https://mailpit.axllent.org/docs/install/docker/), pinned in `deploy/mailpit.local.yaml`.
