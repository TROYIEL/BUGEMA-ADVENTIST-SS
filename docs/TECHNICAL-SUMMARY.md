# Technical summary

The fifteen points the brief asked for, in the order it asked for them.
This is the reference for whoever operates or extends the system; the
[README](../README.md) is the working developer guide and
[DEPLOYMENT.md](./DEPLOYMENT.md) the production runbook.

## 1. Architecture

Two **independent Next.js projects** that share nothing but a PostgreSQL
database and a file store. Each has its own `package.json`, lockfile,
`node_modules`, `.env`, Prisma schema and client, tests and scripts; neither
imports from the other, and either can be moved to its own repository as it
stands.

| Project | Role |
| --- | --- |
| `admin/` | Administration system: applications, content, media, school data, settings, users, audit. Port 3001. **Owns the database** — schema, migrations, seed and every CLI script live here. Sends `X-Robots-Tag: noindex`. |
| `web/` | Public website, admissions wizard and applicant portal. Port 3000. Ships no administration code at all; carries an identical copy of the Prisma schema purely to generate its own client. |

Inside each project the code is arranged the same way: `src/app` (routes),
`src/components` (page components) and `src/components/ui` (primitives and
design tokens), `src/lib` (everything with a database behind it),
`src/lib/db` (Prisma client factory and singleton), `src/lib/auth` (the
authentication that project needs), `src/generated` (the Prisma client,
gitignored). Modules that both projects need — the mail outbox, storage
drivers, sanitiser, rate limiter, application schemas — exist as a copy in
each; they are two codebases by design.

Stack: Next.js 16 (App Router, React Server Components, Server Actions,
`proxy.ts`), React 19, TypeScript strict, Tailwind v4 (CSS-first tokens),
Prisma 7 with the `pg` driver adapter, PostgreSQL 16/17, Zod, `sharp`,
`sanitize-html`, `nodemailer`, `@aws-sdk/client-s3`. No CSS framework beyond
Tailwind, no component library, no charting library, no search service.

Nothing resolves paths against the working directory — each project's
`src/lib/db/env.ts` locates its own root, so `.env` and a relative storage
directory mean the same thing to `next dev`, the tests and the scripts. When
both projects run on one machine with the local storage driver they are given
the same absolute `STORAGE_LOCAL_DIR`.

Rendering model: every page that reads the database declares
`dynamic = "force-dynamic"` and queries Prisma directly per request.
`cacheComponents` is off (see §14).

## 2. Routes

**Public site** (`web/`) — 21 pages, 4 route handlers, plus
`sitemap.xml`, `robots.txt` and a generated `opengraph-image`.

| Area | Routes |
| --- | --- |
| Home & about | `/`, `/about/leadership` |
| Academics | `/academics`, `/academics/departments`, `/academics/departments/[slug]`, `/academics/programmes/[slug]`, `/academics/subjects` |
| Admissions | `/admissions`, `/admissions/requirements`, `/admissions/apply`, `/admissions/apply/[step]`, `/admissions/application-status` |
| Content | `/news`, `/news/[slug]`, `/events`, `/events/[slug]`, `/gallery`, `/gallery/[slug]`, `/search`, `/contact` |
| CMS pages | `/[...slug]` — any page created in the admin app (static routes always win) |
| Handlers | `/admissions/apply/resume` (draft resume link), `/admissions/application-status/access/[token]` (portal link), `/admissions/application-status/documents/[id]` (applicant's own file), `/media/[...key]` (public media) |

**Admin app** (`admin/`) — 43 pages, 4 route handlers.

| Area | Routes |
| --- | --- |
| Entry | `/login`, `/` (dashboard), `/account` |
| Admissions | `/applications`, `/applications/[id]`, `/applications/export` (CSV), `/applications/documents/[id]` (private file), `/print/applications/[id]` (print / PDF view), `/documents`, `/requirements`, `/academic-years` |
| Content | `/pages`, `/news`, `/events`, `/gallery`, `/announcements`, `/hero-slides`, `/media-library` — each with `/new` and `/[id]` |
| School | `/academics` (+ `departments`, `programmes`), `/staff`, `/enquiries` |
| Settings | `/settings`, `/navigation`, `/users`, `/audit` |
| Handlers | `/media/[...key]`, `/api/cron/mail` (outbox retry, bearer-secret) |

Every mutation is a Server Action colocated with its module (21 action
files). Route handlers exist only where a Server Action cannot do the job:
file bodies, downloads, redirects from emailed links, and the cron endpoint.

## 3. Database

34 Prisma models, 15 enums, 7 migrations (`admin/prisma`; `web/prisma/schema.prisma` is an identical copy without migrations).

| Group | Models |
| --- | --- |
| Identity & audit | `User`, `Session`, `AuditLog` |
| Admissions | `AcademicYear`, `ApplicationClass`, `AdmissionRequirement`, `DocumentType`, `ApplicationFormField`, `Application`, `ApplicationDocument`, `ApplicationEvent`, `ApplicationNote`, `ApplicationMessage`, `ApplicationCounter` |
| Content | `Page`, `HomeFeature`, `HomeHighlight`, `HeroSlide`, `NewsArticle`, `Event`, `GalleryAlbum`, `GalleryImage`, `Announcement`, `NavigationItem`, `SiteSetting`, `MediaAsset` |
| School | `AcademicDepartment`, `Subject`, `AcademicProgram`, `StaffProfile` |
| Infrastructure | `ContactEnquiry`, `EmailOutbox`, `SearchDocument`, `RateLimit` |

Notable details:

- Applications keep the stable core (applicant, guardian, schooling) as typed
  columns; admin-configured extra questions live in an `answers` JSONB column.
- Reference numbers (`BASS-YYYY-000123`) are allocated at submission by one
  atomic SQL statement that locks the draft, increments the per-year counter
  and writes the history event together. Nothing is burned on a failed or
  duplicate submission, and it holds under concurrency through a connection
  pooler (there is a 25-way concurrent test).
- Site search is PostgreSQL full-text: a generated `tsvector` column kept by a
  trigger, with GIN and trigram indexes, refreshed on every content write.
- Indexes cover every list filter the admin app offers (status × year ×
  class, status × published date, slugs, token hashes, checksums).

## 4. Authentication

**Staff.** Email + password. Passwords are hashed with Node's built-in
`scrypt` (no external dependency) and checked with a constant-time compare.
A successful sign-in creates a `Session` row holding the SHA-256 of a
random 256-bit token; only the token goes in the cookie (`HttpOnly`,
`SameSite=Lax`, `Secure` in production). Sessions last 12 hours, are
revocable server-side, and every one is dropped when the user's role
changes or the account is disabled; changing your own password signs out
your other devices. Sign-in is rate limited per IP and per
account and returns the same message for a wrong password, an unknown
address and a disabled account.

**Applicants** never get accounts. A draft is tied to a signed cookie (30
days) and can be resumed on another device through an emailed link. On
submission the applicant receives a 256-bit access token by email — only its
hash is stored — which opens the portal for two hours per visit. The
status page also accepts reference + surname + date of birth. Token
exchanges and lookups are rate limited.

**Enforcement.** `proxy.ts` only checks that a cookie exists (it runs on
prefetches and must not touch the database). The real boundary is the data
access layer in `admin/src/lib/auth/dal.ts`: every page, Server Action and route
handler calls `requirePermission` / `requirePagePermission` / `requireDraft`
itself. Layouts are never a security boundary.

## 5. Roles and permissions

Five roles map onto 23 fine-grained permissions (`admin/src/lib/auth/rbac.ts`). The website has no roles at all — no staff code ships in it.

| Role | Can |
| --- | --- |
| `SUPER_ADMIN` | Everything, including creating users, changing roles and reading the audit log. |
| `ADMIN` | Run the site and admissions day to day: all application and content permissions, media deletion, academics, staff, admissions configuration, navigation, site settings, audit log. Cannot manage user accounts. |
| `ADMISSIONS_OFFICER` | Read, work, decide and export applications; review documents; read and answer applicant messages; configure admissions. Read-only on content and media. |
| `CONTENT_EDITOR` | Create, edit and publish pages, news, events, gallery albums and announcements; manage media (not delete). No access to applications. |
| `STAFF` | Sign in and read the dashboard, content and media. Nothing else until a role is assigned. |

Permissions are checked on the server, and the sidebar, dashboard tiles and
action buttons are filtered by the same table so no role is shown something
it cannot use. Decisions (moving into or out of ACCEPTED /
CONDITIONALLY_ACCEPTED / REJECTED) require the separate
`applications:decide` permission.

## 6. Admissions workflow

**Applicant side.** Six wizard steps — Applicant → Guardian → Academic →
Additional (admin-configured questions) → Documents → Review — each with its
own Zod schema shared between client and server. Every step autosaves the
draft; a resume link can be emailed. Documents are uploaded per configured
document type, validated by size and magic bytes. Submission validates the
whole application again, allocates the reference number, emails a
confirmation with the portal link, and notifies the admissions address.

**Statuses.**

```
DRAFT → SUBMITTED → UNDER_REVIEW ⇄ DOCUMENTS_REQUIRED → SHORTLISTED
                                      ↓
        ACCEPTED | CONDITIONALLY_ACCEPTED | REJECTED        WITHDRAWN (any time after submission)
```

Drafts are the applicant's alone. Staff may set any post-submission status;
entering or leaving a decision status needs `applications:decide`. Each
change writes an `ApplicationEvent` (visible to the applicant when marked
so), an audit-log row, and an email to the applicant. Documents are
individually marked PENDING / VERIFIED / REJECTED / REPLACEMENT_REQUIRED,
and a replacement request reopens upload for that document only.

**Staff side.** Filter (status, year, class, free text), sort, paginate;
detail view with answers, documents, internal notes, applicant messages and
full history; CSV export (audited) and a print / save-as-PDF view.

**Portal.** Status, history, documents (with re-upload when requested), and
two-way messages with the admissions office.

## 7. CMS capabilities

- **Pages** — rich-text pages at any URL, with SEO fields and draft /
  published state.
- **News**, **Events** (with dates and venue), **Gallery** albums,
  **Announcements** (site-wide bar with a schedule), **Hero slides**.
- **Rich text** — headings, lists, links, quotes, tables and images from the
  media library. HTML is sanitised against an allow-list on write *and* on
  render.
- **Media library** — uploads are magic-byte checked, EXIF orientation is
  baked in and metadata stripped, images are capped to a maximum edge and
  converted to WebP with a blur placeholder, and a checksum is recorded. SVG
  is rejected.
- **School data** — departments, subjects, programmes, staff profiles.
- **Site settings** — grouped, typed settings (identity, contact, social,
  admissions, SEO); the dashboard lists every placeholder still unfilled.
- **Navigation** — the header and footer menus, reorderable.
- **Enquiries** — contact-form messages, marked unread / read / archived /
  spam.
- **Users** and **Audit log** — every administrative write is recorded with
  actor, target and before / after.

The homepage layout is code, not a page builder: its sections are fixed and
read their content from the database.

## 8. File storage

One `StorageAdapter` interface with two drivers, chosen by `STORAGE_DRIVER`.

- `local` — files under `STORAGE_LOCAL_DIR` (resolved against the repository
  root). Right for a single server.
- `s3` — any S3-compatible store: AWS S3, Cloudflare R2, Neon Object Storage,
  MinIO. Required on platforms without a persistent disk.

Public media and private application documents are separate prefixes; both
are served through route handlers, never from `public/`, so an application
document is only readable by its applicant (via their session) or by staff
with `applications:read`. Keys are validated against traversal in every
driver.

## 9. Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by the apps (the pooled one on Neon). |
| `DATABASE_URL_UNPOOLED` | Direct connection for migrations and CLI scripts; optional when not pooled. |
| `SESSION_SECRET` | Signs applicant cookies. Required. |
| `NEXT_PUBLIC_SITE_URL` | Absolute public origin: canonical URLs, sitemap, OG tags, links in email. |
| `STORAGE_DRIVER` | `local` or `s3`. |
| `STORAGE_LOCAL_DIR` | Directory for the local driver. |
| `STORAGE_S3_BUCKET`, `STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY` | S3 credentials. |
| `STORAGE_S3_ENDPOINT`, `STORAGE_S3_REGION`, `STORAGE_S3_FORCE_PATH_STYLE` | Non-AWS providers; region defaults to `auto`. |
| `MAIL_DRIVER` | `outbox` (store only, default), `console`, or `smtp`. |
| `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS`, `MAIL_ADMIN_NOTIFICATIONS` | Sender identity; address that gets new-application / new-enquiry notices. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` | SMTP delivery. |
| `CRON_SECRET` | Bearer token for `/api/cron/mail`; the endpoint is 404 until set. |
| `MAIL_FLUSH_LIMIT` | Rows per `mail:flush` run (default 50). |
| `BASS_ADMIN_PASSWORD` | Read by `create-admin --password-from-env`; never pass passwords on the command line. |
| `POSTGRES_*` | Only for the local Docker database. |

Each project has its own `.env.example` documenting the subset it reads;
`CRON_SECRET`, `BASS_ADMIN_PASSWORD`, `DATABASE_URL_UNPOOLED` and `POSTGRES_*`
are admin-only, `SESSION_SECRET` is web-only, and `DATABASE_URL`,
`STORAGE_*`, `MAIL_*`/`SMTP_*` and `NEXT_PUBLIC_SITE_URL` must agree.

## 10. Running locally

Each project is started from its own directory. The administration project
first, because it creates the database:

```bash
cd admin
npm install            # generates the Prisma client
cp .env.example .env   # DATABASE_URL, STORAGE_LOCAL_DIR (absolute), …
npm run db:up          # PostgreSQL in Docker (or point DATABASE_URL at Neon)
npm run db:migrate
npm run db:seed
npm run create-admin
npm run dev            # http://localhost:3001

cd ../web
npm install
cp .env.example .env   # same DATABASE_URL and STORAGE_LOCAL_DIR; SESSION_SECRET
npm run dev            # http://localhost:3000
```

Checks, in each project: `npm run lint`, `npm run typecheck`, `npm test`
(unit and database tests — 88 cases in web, 116 in admin), `npm run build`,
`npm run test:e2e` (smoke + axe-core accessibility + responsive checks
against that project's running dev server; needs Chrome).

## 11. Seeding

`npm run db:seed` (in `admin/`) is idempotent and creates only structure and placeholders:
the settings registry (every school fact empty and marked), navigation, the
core pages, an academic year and classes, document types, admission
requirement placeholders, and the ten supplied photographs plus the crest
imported into the media library with semantic names, dimensions and blur
data. `npm run db:seed:demo` adds clearly-labelled demonstration content for
presentations; it is not for production.

## 12. First administrator

`npm run create-admin` in `admin/` (interactive), or non-interactively with the password
in the environment:

```bash
BASS_ADMIN_PASSWORD='…' npm run create-admin -- \
  --name "Site Administrator" --email admin@example.com --password-from-env
```

The first account is always `SUPER_ADMIN`. Later accounts are created under
**Users** in the admin app. Passwords must meet the policy in
`admin/src/lib/auth/password-policy.ts`.

## 13. Production deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the step-by-step runbook. In
outline: a managed PostgreSQL (Neon), an S3-compatible bucket, the two apps
deployed as two services from their two directories (a hosting platform
such as Vercel, or `next start` behind a reverse proxy on a VPS),
`npm run db:deploy` in `admin/` on each release, and
either cron or a scheduler hitting `/api/cron/mail` so that queued mail is
retried.

## 14. Assumptions and deliberate choices

- **Two codebases, duplicated where they overlap.** The modules both
  projects need (mail, storage, sanitiser, rate limiter, application
  schemas, UI primitives) are copied, not shared, so that each project can
  be installed, built, tested, deployed and moved to its own repository with
  no reference to the other. The price is that a fix to one copy has to be
  made in both, and the Prisma schema has to be copied from `admin/` to
  `web/` after every migration. Both are called out in each README.
- **`cacheComponents` is off.** Administrators expect edits to appear
  immediately and the pages query a local database; the simpler dynamic model
  wins. Turning it on later is a different programming model, not a flag.
- **No Content-Security-Policy header yet.** A strict CSP needs per-request
  nonces threaded through both apps; it is documented here as the next
  hardening step rather than shipped half-done. HSTS, `nosniff`,
  `X-Frame-Options` and the admin `noindex` are in place.
- **Mail is at-least-once, not exactly-once.** Every message is recorded
  before delivery is attempted; retries stop after five attempts and the
  dashboard shows what is still queued.
- **The rate limiter is database-backed**, so it works across several
  instances without Redis; it is meant to slow abuse and make it visible, not
  to be a WAF.
- **Applicants have no accounts** by design — tokens and reference lookups
  are enough for a once-a-year process and remove a whole class of support
  requests.
- **Local storage is the default** for simplicity; the S3 driver is tested
  against MinIO and is what a hosted deploy should use.
- **Placeholder content.** No fact about the school has been invented; see
  §15 and the README's content policy.

## 15. Still required from the school

Postal and physical address · phone · email · mission, vision and values ·
founding history · leadership names, titles and photographs · subjects and
combinations actually offered · entry requirements and required documents ·
fee structure · term dates · social links · map location · official policy
text (privacy, terms, admissions, safeguarding) · confirmation of the motto
· an SMTP account or transactional mail provider · a domain and TLS · more
photography (sport, worship, clubs, leadership portraits, classrooms beyond
the science laboratory).
