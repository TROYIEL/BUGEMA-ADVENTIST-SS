# BASS — Administration system

The management system for Bugema Adventist Secondary School: admissions,
content, media, school data, settings, users and the audit log. It **owns the
database** — the Prisma schema, migrations, seed and every CLI script live
here. The public website is a separate project that connects to the same
database and the same file storage; nothing is shared between the two
codebases.

Runs on <http://localhost:3001>.

## Requirements

- Node.js 20.19+ (developed on 22.x)
- PostgreSQL 16+ — Docker for a local one (`docker-compose.yml` is here), or a
  hosted database such as Neon
- Google Chrome, only for `npm run test:e2e`

## Running locally

```bash
npm install                   # also generates the Prisma client
cp .env.example .env          # then fill in DATABASE_URL, STORAGE_LOCAL_DIR
npm run db:up                 # PostgreSQL 17 in Docker (skip with a hosted DB)
npm run db:migrate            # apply migrations
npm run db:seed               # settings, navigation, pages, photographs, crest
npm run create-admin          # first administrator (SUPER_ADMIN)
npm run dev                   # http://localhost:3001
```

`.env` is read from this directory by Next.js, the Prisma CLI and every
script. Nothing is resolved against the working directory: a relative
`STORAGE_LOCAL_DIR` means a directory under *this project*, so when the
website runs on the same machine with the local storage driver, **give both
projects the same absolute path** (or use the S3 driver). Both must also point
at the same database.

### A hosted database (Neon)

`DATABASE_URL` is the *pooled* connection string (the `-pooler` host) for the
app; `DATABASE_URL_UNPOOLED` the direct one, which migrations, Studio and the
scripts use when it is set — Prisma Migrate's advisory lock and shadow
database do not work through a pooler. `neon.ts` holds the branch policy and
`.neon` (gitignored) the project and branch; `neon env pull` writes both URLs
into `.env`. `createPrismaClient` pins `sslmode=verify-full` on whatever
string it is given.

To move a local database across, dump and restore rather than re-seeding, so
the migration history travels with it:

```bash
docker exec bass-db pg_dump -U bass -d bass --no-owner --no-privileges > local.sql
psql "$DATABASE_URL_UNPOOLED" -v ON_ERROR_STOP=1 --single-transaction < local.sql
```

Uploaded files are not in the database; the storage directory (or bucket)
has to travel with it.

### Demonstration data

`npm run db:seed:demo` adds clearly labelled sample content — stories,
events, staff, enquiries, applications — for presentations. Every row uses
the reserved `@bass.example.com` domain and is removed again with
`npm run db:seed:demo -- --purge`. Not for production.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | The app on port 3001 |
| `npm run lint` / `typecheck` | ESLint; `next typegen` then `tsc --noEmit` |
| `npm test` | Unit and database tests (`src/**/*.test.ts`; needs `DATABASE_URL`) |
| `npm run test:e2e` | Smoke, accessibility (axe-core) and responsive checks against a running dev server |
| `npm run db:up` / `db:down` | Start / stop the Docker PostgreSQL |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:deploy` | Apply pending migrations without prompting (production) |
| `npm run db:status` / `db:reset` / `db:studio` | Migration status; drop and rebuild; browse |
| `npm run db:seed` | Seed structure and placeholders (idempotent) |
| `npm run db:generate` | Regenerate the Prisma client into `src/generated/` |
| `npm run create-admin` | Create an administrator |
| `npm run search:reindex` | Rebuild the website's search index |
| `npm run mail:flush` | Retry queued and failed outbox mail (for cron) |

### Creating administrators

Interactive: `npm run create-admin`. Non-interactive, with the password from
the environment so it never lands in `argv` or shell history:

```bash
BASS_ADMIN_PASSWORD='…' npm run create-admin -- \
  --name "Site Administrator" --email admin@example.com --password-from-env
```

The first account is always a `SUPER_ADMIN`. Later accounts take `--role`, or
are created under **Users** in the app.

## Layout

```
admin/
  prisma/
    schema.prisma       the database — the website keeps an identical copy
    migrations/         Prisma Migrate history (only here)
    seed.ts             structure + placeholders; seed-demo.ts adds sample data
    images/             the source photographs and crest the seed imports
  scripts/
    create-admin.ts  reindex.ts  flush-mail.ts  e2e-session.ts
    e2e/              smoke + a11y suites and the runner
  src/
    app/              routes: (auth)/login, (dashboard)/…, print/, api/cron/mail, media/
    components/       page-level components by module
    components/ui/    primitives and design tokens (tokens.css)
    lib/              everything with the database behind it
    lib/db/           Prisma client factory, singleton, .env loading
    lib/auth/         passwords, sessions, RBAC, data-access-layer guards
    generated/        Prisma client (gitignored; `npm run db:generate`)
    proxy.ts          cookie-presence redirect to /login (Next 16's middleware)
  docker-compose.yml  neon.ts  prisma.config.ts  .env.example
```

## Architecture

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16, App Router, React Server Components, Server Actions |
| Styling | Tailwind CSS v4, tokens in `src/components/ui/tokens.css` |
| Database | PostgreSQL via Prisma 7 with the `pg` driver adapter |
| Validation | Zod |
| Auth | Opaque session tokens, SHA-256 hashed in the database, 12-hour lifetime |
| Passwords | Node's built-in `scrypt` |
| File storage | `StorageAdapter` with `local` and `s3` drivers (`src/lib/storage.ts`) |
| Images | `sharp` — EXIF stripped, bounded, re-encoded to WebP |
| Email | `email_outbox` table; `outbox` / `console` / `smtp` drivers; retry via `mail:flush` and `/api/cron/mail` |
| Search | PostgreSQL full-text (`tsvector` + trigram), maintained on every content write |

### Roles

Five roles over 23 permissions (`src/lib/auth/rbac.ts`): `SUPER_ADMIN`
(everything, including users), `ADMIN` (runs the site and admissions; no
user management), `ADMISSIONS_OFFICER` (applications, documents, messages,
admissions configuration), `CONTENT_EDITOR` (pages, news, events, gallery,
announcements, media), `STAFF` (read-only until a role is assigned). The
sidebar, dashboard tiles and buttons are filtered by the same table on the
server, and every Server Action, Route Handler and page re-checks it.

### Admissions

`src/lib/applications-admin.ts` backs `/applications` and `/documents`.
Every action re-reads the row under the signed-in user's permissions and
takes only an id plus the change. Moving into *or out of* an outcome
(accepted, conditional, rejected) needs `applications:decide`; everything
else `applications:write`. Rejecting a document or asking for a replacement
moves a submitted or under-review application to "documents needed", which
reopens the upload in the applicant's portal on the website. Status changes
and messages are queued as email when the applicant gave an address, and
always appear in the portal. CSV export honours the list's filters, guards
against spreadsheet formula injection, and is written to the audit log.
`/print/applications/[id]` is a print / save-as-PDF view.

**Configuration** (`src/lib/admissions-config.ts`, `admissions:configure`)
lives behind `/requirements` — classes, document types, published entry
requirements, extra questions — and `/academic-years`. The website reads it
live. Rows that applications refer to are switched off, not deleted.

### Content, media and school data

- **Pages, news, events, gallery, announcements** — `src/lib/content-admin.ts`
  (`content:write` / `content:publish`; announcements `announcements:write`).
  Bodies are written in `src/components/ui/rich-text-editor.tsx`, whose
  toolbar (headings, lists, links, quotes, tables, images from the media
  library) matches the sanitiser's vocabulary; the sanitiser runs on write and
  the website runs it again on render. Saving keeps the search index in step,
  so a draft cannot surface through search.
- **Hero slides** — `/hero-slides`; photographs picked from the library or
  uploaded from the form (`bodySizeLimit` is 24 MB for that reason).
- **Media library** — `/media-library` over `src/lib/media-library.ts`.
  Uploads are validated by magic bytes, re-encoded to WebP with metadata
  stripped, and stored PUBLIC. A photograph cannot be deleted while anything
  on the website shows it; the page lists every place.
- **Academics, staff, enquiries** — `src/lib/school-admin.ts`. Programmes,
  departments and subjects with ordering; staff profiles behind the
  leadership page; the inbox for the website's contact form.
- **Site settings** — generated from `src/lib/settings-registry.ts`, one form
  per group; an unfilled setting is badged and the dashboard lists it under
  "Complete your site". **Navigation**, **Users** (super administrators only;
  used accounts are disabled, never deleted), **Audit log** (read-only), and
  an **account page** for one's own name and password.

### Security

- Authorisation lives in `src/lib/auth/dal.ts` and is re-checked inside every
  Server Action, Route Handler and protected page. `proxy.ts` only checks that
  a cookie is present — it runs on prefetches and must never query the
  database. Layouts are never a security boundary.
- Sign-in is rate limited per IP and per account and answers identically for
  a wrong password, an unknown address and a disabled account.
- Uploads are validated by magic bytes, not filename or `Content-Type`; SVG is
  rejected. Files live outside `public/` and are served by `/media/[...key]`.
- Every response carries HSTS, `nosniff`, `X-Frame-Options: DENY`, a referrer
  policy, a permissions policy and `X-Robots-Tag: noindex, nofollow,
  noarchive`. There is no Content-Security-Policy yet; it needs per-request
  nonces and is the next hardening step.
- `/api/cron/mail` is a 404 until `CRON_SECRET` is set, then accepts only that
  bearer token, compared in constant time.
- Reference numbers are allocated by the website in one atomic statement;
  the concurrency test for it runs here too (`src/lib/applications.test.ts`).

### Notes for anyone extending this

Next.js 16 differs from most published examples: `middleware.ts` is
**`proxy.ts`**; `params`, `searchParams`, `cookies()` and `headers()` are
**Promises**; `revalidateTag` needs a profile argument; `<Image priority>` is
`preload`; route types are generated, so run `npm run typecheck` after adding
a route. Prisma 7: the generator is `prisma-client` with a required `output`
(here `src/generated/prisma`), the datasource URL lives in `prisma.config.ts`,
and a driver adapter is mandatory. Scripts run through `tsx` wrap their body
in an `async main()`.

Tailwind v4 traps already hit: `translate-*` compiles to the CSS `translate`
property (transition that, not `transform`); `tailwind-merge` must be told
about the custom `--text-display-*` sizes (`src/components/ui/cn.ts`,
guarded by `cn.test.ts`); hover styles sit inside `@media (hover: hover)`,
which headless Chrome does not match unless launched with the blink flags in
`scripts/e2e/lib/browser.mjs`.

Anything on the write path that must be atomic under concurrency should be
one SQL statement, not an interactive transaction with several awaits inside
— through a connection pooler those queue on locks and time out.

`cacheComponents` is deliberately off: pages that read the database use
`export const dynamic = "force-dynamic"`.

**Keeping the two projects in step.** `prisma/schema.prisma` is the single
source of truth. After a migration here, copy the schema file into the
website project and run its `npm run db:generate`; the website has no
migrations of its own. Tests only ever touch rows they created (prefixed
`zz-`) and clean up afterwards — the database may be in use by someone else.

## Content policy

No fact about the school is invented anywhere in this codebase. Contact
details, motto, history, leadership, subjects, fees and entry requirements are
seeded as empty, clearly marked placeholders; the dashboard lists every
outstanding item. Still required from the school: postal and physical
address · phone · email · mission, vision and values · founding history ·
leadership names, titles and photographs · subjects and combinations offered ·
entry requirements and required documents · fee structure · term dates ·
social links · map location · official policy text · confirmation of the
motto · more photography.
