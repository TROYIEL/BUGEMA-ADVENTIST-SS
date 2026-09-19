# Deployment

How to put the website and the administration system into production. Two
routes are described: a hosting platform (Vercel or similar) with managed
services, and a single Linux server. Both share the same preparation.

## Before anything else

1. **A domain and TLS.** Two hostnames — e.g. `www.school.example` for the
   site and `admin.school.example` for the administration system. The admin
   hostname can sit behind a VPN or an IP allow-list; nothing on the public
   site needs to reach it.
2. **PostgreSQL.** A managed database is the sensible default. The
   repository is set up for [Neon](https://neon.tech): the apps use the
   *pooled* connection string as `DATABASE_URL` and migrations use the direct
   one as `DATABASE_URL_UNPOOLED`. Any PostgreSQL 16+ works; if it is not
   pooled, leave `DATABASE_URL_UNPOOLED` unset.
3. **Object storage** (platform deploys only). An S3-compatible bucket —
   AWS S3, Cloudflare R2, Neon Object Storage, MinIO. Create a bucket and an
   access key that can read, write, delete and list within it. The bucket
   must **not** be public: every file is served through the apps.
4. **SMTP.** A transactional mail account (or the school's mail server) that
   allows sending from `no-reply@…`. Until this exists mail is safely queued;
   set `MAIL_DRIVER=outbox` and nothing is lost.
5. **Secrets.** Generate once and keep out of the repository:

   ```bash
   openssl rand -base64 32   # SESSION_SECRET
   openssl rand -hex 32      # CRON_SECRET
   ```

## Environment

Fill every variable in `.env.example`. The values that differ from
development:

```ini
NEXT_PUBLIC_SITE_URL=https://www.school.example
DATABASE_URL=postgresql://…-pooler…/…?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://…/…?sslmode=require
SESSION_SECRET=…
CRON_SECRET=…

STORAGE_DRIVER=s3          # or local, on a server with a disk
STORAGE_S3_BUCKET=bass-media
STORAGE_S3_ACCESS_KEY_ID=…
STORAGE_S3_SECRET_ACCESS_KEY=…
STORAGE_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com   # unset for AWS
STORAGE_S3_REGION=auto                                          # or the AWS region

MAIL_DRIVER=smtp
MAIL_FROM_NAME="Bugema Adventist Secondary School"
MAIL_FROM_ADDRESS=no-reply@school.example
MAIL_ADMIN_NOTIFICATIONS=admissions@school.example
SMTP_HOST=… SMTP_PORT=587 SMTP_SECURE=false SMTP_USER=… SMTP_PASSWORD=…
```

Both apps need the same variables. `NEXT_PUBLIC_SITE_URL` is the *public
site's* origin in both — the admin app uses it for the links inside email.

## Database

Migrations are applied with the non-interactive command, never `db:migrate`,
which would try to create new migrations:

All database commands run from the **`admin/`** project, which owns the
schema; the website has no migrations.

```bash
cd admin
npm run db:deploy      # prisma migrate deploy, over DATABASE_URL_UNPOOLED
npm run db:seed        # idempotent; safe to re-run on every release
```

Then the first administrator:

```bash
BASS_ADMIN_PASSWORD='…' npm run create-admin -- \
  --name "Site Administrator" --email admin@school.example --password-from-env
```

Moving an existing local database instead of seeding afresh:

```bash
docker exec bass-db pg_dump -U bass -d bass --no-owner --no-privileges > local.sql
psql "$DATABASE_URL_UNPOOLED" -v ON_ERROR_STOP=1 --single-transaction < local.sql
```

and copy `storage/` into the bucket (or onto the server) — uploaded files
are not in the database.

## Route A — hosting platform (Vercel or similar)

Create **two platform projects**, one per directory (or from two
repositories, if the directories have been split out):

| Project | Root directory | Build command | Domain |
| --- | --- | --- | --- |
| web | `web/` | `npm run build` | `www.school.example` |
| admin | `admin/` | `npm run build` | `admin.school.example` |

- Each directory is a complete, self-contained Next.js project with its own
  lockfile; no "include files outside the root" option is needed.
- Set the environment variables on both projects — the same `DATABASE_URL`,
  `STORAGE_*`, `MAIL_*` and `NEXT_PUBLIC_SITE_URL`; `SESSION_SECRET` on web;
  `CRON_SECRET` and `DATABASE_URL_UNPOOLED` on admin.
- `STORAGE_DRIVER` must be `s3`; the platform has no persistent disk.
- Run `npm run db:deploy` in `admin/` as a release step (a deploy hook, a CI
  job, or by hand from a machine with `DATABASE_URL_UNPOOLED`). The apps do
  not migrate on boot.
- Schedule the outbox retry. On Vercel, `admin/vercel.json`:

  ```json
  { "crons": [{ "path": "/api/cron/mail", "schedule": "*/10 * * * *" }] }
  ```

  Vercel sends `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is
  set in the project — the endpoint expects exactly that header. Any other
  scheduler (GitHub Actions, a monitoring ping) can send it too.

Region: put the functions in the same region as the database; every page is
rendered per request.

## Route B — a single Linux server

Requirements: Node.js 20.19+ (22 recommended), PostgreSQL (local or managed),
nginx or Caddy for TLS, a process manager (systemd or pm2).

```bash
git clone … /srv/bass
mkdir -p /srv/bass/storage                # both projects point here

cd /srv/bass/admin
cp .env.example .env && $EDITOR .env      # STORAGE_LOCAL_DIR=/srv/bass/storage
npm ci
npm run db:deploy && npm run db:seed
BASS_ADMIN_PASSWORD='…' npm run create-admin -- --name … --email … --password-from-env
npm run build

cd /srv/bass/web
cp .env.example .env && $EDITOR .env      # same DATABASE_URL and STORAGE_LOCAL_DIR
npm ci
npm run build
```

Run both apps under systemd (one unit each):

```ini
# /etc/systemd/system/bass-web.service
[Service]
WorkingDirectory=/srv/bass/web
ExecStart=/usr/bin/npm run start                # next start --port 3000
Environment=NODE_ENV=production
Restart=always
User=bass
```

and the same for `bass-admin` with `WorkingDirectory=/srv/bass/admin`
(port 3001). Reverse proxy
`www.school.example` → `:3000` and `admin.school.example` → `:3001` with
TLS; the apps already send HSTS.

Persist and back up:

- the database (`pg_dump` nightly, or the provider's backups);
- `/srv/bass/storage` — uploaded media and every application document.

Outbox retry from cron:

```cron
*/10 * * * *  cd /srv/bass/admin && npm run mail:flush >> /var/log/bass-mail.log 2>&1
```

Releases: `git pull`, then in `admin/` `npm ci && npm run db:deploy &&
npm run build` and in `web/` `npm ci && npm run build`, then restart both
units. When a release changes the schema, `web/prisma/schema.prisma` must
already carry the same change (it is copied from `admin/` in development). `next build` writes to `.next` inside each app, so build
before restarting rather than in place if downtime matters; a blue/green
checkout is the simplest way to get zero-downtime restarts.

## After the first deploy

1. Sign in at `https://admin.school.example`, open **Site settings** and
   work through the "Complete your site" list on the dashboard.
2. Send yourself a test application from the public site and confirm the
   two emails arrive (applicant confirmation, admissions notification). If
   they are sitting in the outbox instead, the SMTP settings are wrong —
   the dashboard says so.
3. Check `https://www.school.example/sitemap.xml` and `/robots.txt`, and that
   the admin hostname returns `X-Robots-Tag: noindex`.
4. Optionally run each project's end-to-end suite against its live URL:
   `E2E_BASE_URL=https://www.school.example npm run test:e2e` in `web/` is
   read-only; the same in `admin/` also creates a temporary
   super-administrator (`zz-e2e@bass.example.com`) in the production
   database for the run and deletes it afterwards — skip that one if it is
   not acceptable.

## Operations

| Task | How |
| --- | --- |
| Add an administrator | **Users** in the admin app (super administrators only). |
| Rotate `SESSION_SECRET` | Signs every applicant out of drafts and portals; staff sessions are unaffected. |
| Rotate `CRON_SECRET` | Update the variable and the scheduler together. |
| Rebuild search | `npm run search:reindex` in `admin/` — only needed after a bulk import. |
| Retry stuck mail by hand | `npm run mail:flush` in `admin/`, or `curl -H "Authorization: Bearer $CRON_SECRET" https://admin…/api/cron/mail`. |
| Inspect data | `npm run db:studio` in `admin/` from a machine with the direct connection string. |

Things that are *not* done for you:

- Nothing rotates logs, monitors uptime or alerts on a full disk. Use the
  platform's tooling or the server's usual ones.
- There is no Content-Security-Policy header yet (see the technical
  summary). If the reverse proxy adds one, it must allow inline styles and
  the Next.js runtime script, or test carefully.
- The rate limiter keeps one row per key (an IP address, an account) and
  reuses it across windows, so the table stays small. Rows past their
  `expiresAt` can be deleted at any time if it ever matters.
