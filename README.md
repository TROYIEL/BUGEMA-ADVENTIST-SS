# Bugema Adventist Secondary School (BASS)

Two applications sharing one database: the public website, and the
administration system that manages it.

**Status: milestones 1–3 of 5 complete, milestone 4 in progress** (the
Admissions, Content and School groups of the admin sidebar are live; the
Settings group is next), plus the split into separate applications. See
[Milestones](#milestones).

---

## Layout

```
bass/
  apps/
    web/      public website          -> localhost:3000
    admin/    administration system   -> localhost:3001
  packages/
    db/       Prisma schema, migrations, seeds, client
    auth/     passwords, sessions, RBAC, data access layer
    core/     storage, media, mail, settings, search, content queries
    ui/       shared primitives and design tokens
  bass-images/  source photographs and the school crest
```

The two apps are deliberately independent. `apps/admin` imports nothing from
`apps/web`, and vice versa — everything they share goes through `packages/*`.
Either can be lifted into its own repository by copying it alongside
`packages/`; see [Splitting the apps apart](#splitting-the-apps-apart).

### Why two apps

- The public site ships **no administration code at all** — not the login
  form, not the dashboard, not the permission tables.
- The admin app can be deployed on an internal network, behind a VPN, or on a
  separate host, without moving the website.
- They have genuinely different jobs, so they have genuinely different
  navigation, density and chrome. Only the palette and the primitives are
  shared, because it is still one institution.

## Requirements

- Node.js 20.19+ (developed on 22.x)
- Docker (for PostgreSQL)

## Running locally

```bash
npm install                   # installs all workspaces, generates the client
npm run setup:env             # root .env -> apps/web/.env, apps/admin/.env
npm run db:up                 # PostgreSQL 17 in Docker
npm run db:migrate            # apply migrations
npm run db:seed               # settings, navigation, pages, photographs, crest
npm run create-admin          # first administrator
npm run dev                   # both apps together
```

- Website: <http://localhost:3000>
- Administration: <http://localhost:3001>

Set `SESSION_SECRET` in the root `.env` before `setup:env`; generate one with
`openssl rand -base64 32`. It signs applicant portal cookies; rotating it signs
every applicant out.

Run one app at a time with `npm run dev:web` or `npm run dev:admin`.

### Demonstration data

```bash
npm run db:seed:demo             # fill the site with sample content
npm run db:seed:demo -- --purge  # remove it again
```

**Not real school information.** Every address is `@bass.example.com` (a
reserved domain that can never be a real mailbox), telephone numbers use an
obvious `+256 700 000 0XX` placeholder block, and the policy pages say in their
opening line that they are placeholder text. Staff names, statistics and
examination figures are invented. Purge before the site goes live.

## Commands

All are run from the repository root.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Both apps |
| `npm run dev:web` / `dev:admin` | One app |
| `npm run build` | Build both |
| `npm test` | Unit and integration tests (needs the database) |
| `npm run typecheck` | `next typegen` then `tsc --noEmit`, both apps |
| `npm run lint` | ESLint, both apps |
| `npm run db:up` / `db:down` | Start / stop PostgreSQL |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:deploy` | Apply migrations without prompting (production) |
| `npm run db:seed` | Seed structure (idempotent) |
| `npm run db:studio` | Browse the database |
| `npm run create-admin` | Create an administrator |
| `npm run search:reindex` | Rebuild the search index |

### Creating administrators

Interactive: `npm run create-admin`.

Non-interactive. The password comes from the environment, never from `argv`,
which is visible to other processes and lands in shell history:

```bash
BASS_ADMIN_PASSWORD='…' npm run create-admin -- \
  --name "Site Administrator" --email admin@example.com --password-from-env
```

The first account is always a `SUPER_ADMIN`. Later accounts take `--role`.

## Architecture

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16.3.4, App Router, React Server Components |
| Styling | Tailwind CSS v4, tokens in `packages/ui/src/tokens.css` |
| Database | PostgreSQL 17 (Docker, named volume `bass-db-data`) |
| ORM | Prisma 7 with the `pg` driver adapter |
| Validation | Zod |
| Auth | Opaque session tokens, SHA-256 hashed in the database |
| Passwords | Node's built-in `scrypt` — no third-party hashing dependency |
| File storage | `StorageAdapter`, local-disk driver (S3 driver stubbed) |
| Images | `sharp` — EXIF stripped, bounded, re-encoded to WebP |
| Email | `MailService` with an `email_outbox` table |

### The homepage is laid out in code

There is no section builder. The order of the homepage bands — hero, quick
actions, feature grid, featured story, programme cards, highlights, news and
events — is fixed in `apps/web/src/app/(site)/page.tsx` and is not editable
from the dashboard.

What each band *contains* still comes from the database: site settings,
`home_features`, `home_highlights`, academic programmes, news and events. The
school changes the content of the front page without a developer, while the
layout stays designed rather than assembled. Each band renders nothing when it
has no content, so an empty database gives a short, correct page rather than a
row of blank cards.

### Admissions

Applicants have no accounts. Two cookies stand in for one, both issued from
`@bass/auth/applicant`:

- **Draft** (`bass_application_draft`, 30 days) holds the raw resume secret for
  an unfinished application; only its SHA-256 is stored, as with admin
  sessions. The "email me a link to continue" button and the confirmation
  email's access link both land on a Route Handler that swaps the token in the
  URL for a cookie and redirects, so secrets never sit in browser history.
- **Portal** (`bass_applicant`, 2 hours) is a signed, expiring claim to one
  submitted application — HMAC-SHA256 over `id:expiry` with `SESSION_SECRET`.
  It is stateless, so there is no applicant session table, and rotating the
  secret signs every applicant out. Issued after a reference + surname + date
  of birth lookup (rate limited, same reply whichever field was wrong) or an
  emailed access link.

The wizard is `apps/web/src/app/(site)/admissions/apply/[step]`. Steps come
from the `ApplicationStep` enum; "additional" only appears when the school has
configured extra questions (`application_form_fields`), and "documents" only
when there are document types for the level applied for. Every step is a plain
`<form action>` to a Server Action, so it works without JavaScript;
`useActionState` only adds pending state and carries validation errors back.
The action never trusts the body for *which* application is being edited —
that always comes from the cookie — and re-validates everything from the
stored row at submission, since an administrator may have added a required
question or document since a step was saved.

Submission runs in one transaction in `@bass/core/applications`: the
per-year counter is bumped with an upsert (`BASS-2026-000123`; concurrent
submissions get consecutive numbers, a failed one burns none), the row is
guarded on `status = DRAFT` so a double-click cannot submit twice, and the
event is written. Mail is queued *after* the transaction — an SMTP outage
must not undo a submission.

Documents are re-encoded by `processUploadedDocument` (metadata stripped,
PDFs byte-identical), stored `PRIVATE`, and served to their owner only by
`admissions/application-status/documents/[id]`, which answers 404 for anyone
else's. Uploads go through a Server Action, so `serverActions.bodySizeLimit`
in `apps/web/next.config.ts` is raised to 10 MB against the 8 MB hard ceiling
in `MAX_DOCUMENT_BYTES`; an administrator's per-type limit is capped by it.

**Configuration** lives in `@bass/core/admissions-config` behind the admin
`/requirements` (classes, document types, published entry requirements, extra
questions) and `/academic-years` pages (`admissions:configure`). The wizard
reads it live. Rows that applications already refer to are switched off, not
deleted; a year with applications is kept as the record of that intake. The
site-wide `admissions.isOpen` switch is on the years page too, since both it
and the active year's switch must be on for the form to open.

**The staff side** is `@bass/core/applications-admin` behind
`apps/admin/.../applications` and `/documents`. Every action re-reads the
row under the signed-in user's permissions and takes only an id plus the
change. Moving into *or out of* an outcome (accepted, conditional, rejected)
needs `applications:decide`; everything else needs `applications:write`.
Rejecting a document or asking for a replacement moves a submitted or
under-review application to "documents needed" automatically, which is what
reopens the upload in the applicant's portal; staff move it on by hand once
the new file is in. Status changes and messages are queued as email when the
applicant gave an address, and always appear in the portal. CSV export honours
the list's filters, guards against spreadsheet formula injection, and is
written to the audit log — it is personal data about children leaving in bulk.

### Homepage hero

The hero is a carousel of `Hero` slides (`apps/web/src/components/sections/`).
Slides the school composes in the admin app (`/hero-slides`, table
`hero_slides`) are used when at least one is live — active and inside its
optional dates. Otherwise the homepage assembles its own from settings, the
admissions window, the latest story and the next event. Photographs are
picked from the public media library or uploaded from the slide form, which
posts them through a Server Action (`bodySizeLimit` is 24 MB in the admin
app for that reason); `@bass/core/media-library` re-encodes and stores them.

### Media library

`/media-library` in the admin app (`media:read` to browse, `media:write` to
upload and describe, `media:delete` to remove) over `@bass/core/media-library`.
Uploads take several photographs at once and report per file; each is
validated by magic bytes, re-encoded to WebP with metadata stripped, and
stored PUBLIC under a folder that is only a label. A photograph cannot be
deleted while anything on the website shows it — the page lists every place
(content rows and image-type site settings) — because a deletion would
silently blank that place. It lives at `/media-library`, not `/media`, because
`/media/[...key]` is where files are served from.

### Content editing

Pages, news, events, gallery albums and announcements are edited in the
admin app over `@bass/core/content-admin` (`content:write` to edit,
`content:publish` to publish; announcements use `announcements:write`).
Bodies are written in `@bass/ui/rich-text-editor`, a small contentEditable
editor whose toolbar matches the sanitiser's vocabulary; the sanitiser maps
the browser's `<b>`/`<i>`/`<div>` to `<strong>`/`<em>`/`<p>` and still runs
on render. Addresses (slugs) are made from titles and de-duplicated with a
suffix; system pages keep theirs. Saving keeps the search index in step —
published rows are indexed, everything else removed — so a draft cannot
surface through search. Gallery albums add photographs from the media
library, with captions and ordering, and the first one becomes the cover.

### School: academics, staff and enquiries

`@bass/core/school-admin` backs three admin sections. **Academics**
(`academics:write`) keeps programmes, departments and subjects on one page in
the order the website shows them, with up/down arrows that swap `order`
values; programmes and departments have full editors, subjects are edited in
place. A department's head and a subject's lead teacher are chosen from the
staff list. **Staff** (`staff:write`) edits the profiles behind the
leadership page, with a photograph from the media library, leadership and
visibility flags, and ordering. **Enquiries** (`messages:read` to see,
`messages:write` to handle) is the inbox for the website's contact form:
opening an enquiry marks it read and records who did so; replies go through
the reader's own mail program (a `mailto:` link with the message quoted),
and an enquiry is then archived, marked unread, marked spam or deleted.
Publishing academics content still needs `content:publish`; without it the
save is refused with a note to keep it as a draft.

### Design language

Adapted from the University of Kent's site as a UX benchmark — its structure
and interaction patterns, not its branding, copy, imagery or markup. Rebuilt in
a navy-and-gold identity taken from the school's own crest.

Recurring devices:

- a gold parallelogram marking the priority navigation item;
- angled edges between full-bleed bands;
- rotated photographs with gold borders in the hero;
- a three-column mega-menu: section summary, links, then featured content;
- pill buttons with a circular arrow that shifts right on hover.

**The hover wipe.** Buttons fill left to right on hover, inset 3px from their
own edge so the border — or a band of the base colour on a solid control —
stays visible around the fill. Outlined buttons fill with their own accent;
solid ones wipe to a deeper shade. It is a `translate` inside an
`overflow-hidden` mask rather than a scale, because scaling a rounded rectangle
stretches its corner radius and the pill visibly deforms mid-wipe. Lives in
`@bass/ui/hover-fill`.

**The mega-menu** opens on hover with intent timing (110ms in, 180ms out) and
on click, and is positioned `absolute … top-full` against the sticky header
rather than at a fixed offset — the announcement bar above the header is not
sticky, so any hardcoded offset opens the panel over the navigation. While
closed it stays mounted but `inert`, which keeps it animatable while remaining
unreachable by tab, screen reader and pointer.

Every animation is disabled under `prefers-reduced-motion`.

### Notes for anyone extending this

Next.js 16 differs from most published examples in ways that will silently
break code written from memory:

- `middleware.ts` is now **`proxy.ts`**, Node runtime only.
- `params`, `searchParams`, `cookies()`, `headers()` and `draftMode()` are
  **Promises**. Synchronous access was removed, not deprecated.
- `revalidateTag(tag)` with one argument is a type error; it needs a profile.
- `<Image priority>` is deprecated in favour of `preload`, and
  `images.qualities` must list every quality the app uses.
- Route types are generated — run `npm run typecheck` after adding a route.

Prisma 7 also differs from v6: the generator is `prisma-client` (not
`prisma-client-js`) with a required `output`, the datasource URL lives in
`prisma.config.ts` rather than the schema, and a **driver adapter is
mandatory** (`new PrismaClient()` with no arguments throws). Prisma's own agent
skills are vendored in `.claude/skills/`.

Scripts run through `tsx` must wrap their body in an `async main()` —
top-level `await` fails with `ERR_REQUIRE_ASYNC_MODULE`.

Tailwind v4 has three traps this project has already hit:

- **`translate-*` compiles to the CSS `translate` property, not `transform`.**
  Transitioning `transform` animates nothing. Transition `translate`.
- **`tailwind-merge` does not know the custom `--text-display-*` sizes.** It
  classifies `text-display-md` as a text *colour* and silently drops any real
  colour merged alongside it, which is how a page heading once ended up navy on
  a navy band. They are registered in `packages/ui/src/cn.ts`; add any new
  display size there too, and `cn.test.ts` will fail if you forget.
- **Hover styles are wrapped in `@media (hover: hover)`.** Headless Chrome
  reports no pointing device, so *every* hover style is inert there and a
  screenshot will never show one. Launch with
  `--blink-settings=availableHoverTypes=2,primaryHoverType=2,availablePointerTypes=4,primaryPointerType=4`
  when testing hover.

**Nothing may be resolved against `process.cwd()`.** The two apps and the CLI
scripts each run from a different directory, so a relative path means a
different place in each. `@bass/db/env` exposes `repoRoot` and `fromRepoRoot`;
storage and the seed use them. Getting this wrong is how the seed once silently
skipped every photograph, and how the two apps would have written uploads into
two separate directories.

`cacheComponents` is deliberately **off**. Public pages that read the database
use `export const dynamic = "force-dynamic"`, so administrators see their edits
immediately and `next build` does not require a reachable database.

### Security

- Authorisation lives in `packages/auth/dal` and is re-checked inside every
  Server Action, Route Handler and protected page. `proxy.ts` only checks that
  a cookie is present — it runs on prefetches and must never query the
  database.
- Layouts are never used as a security boundary; they do not re-render on
  navigation and do not stop children rendering.
- The admin sidebar and dashboard are filtered by permission on the server, so
  neither advertises anything the signed-in role cannot use.
- Uploads are validated by magic bytes, not filename or `Content-Type`. SVG is
  rejected outright as an XSS vector.
- Uploaded files live outside `public/`, so visibility is a decision the
  serving route makes rather than a consequence of where a file was written.
- Sign-in is rate limited per IP address and per account, and returns the same
  message for a wrong password, an unknown address and a disabled account.
- Starting an application, uploading a document, submitting, requesting a
  resume link and looking up an application are each rate limited
  (`RATE_LIMITS` in `@bass/core/rate-limit`).
- The whole admin origin sends `X-Robots-Tag: noindex, nofollow, noarchive`.

## Splitting the apps apart

Each app is already self-contained. To move one into its own repository:

1. Copy the app directory and the whole of `packages/`.
2. Keep the root `package.json` workspaces entry for `packages/*`, and add the
   single app.
3. Copy `docker-compose.yml`, `.env.example` and `scripts/setup-env.mjs`.
4. `bass-images/` is only needed by `packages/db`'s seed.

Nothing else has to be untangled: there are no imports between the two apps.

## Content policy

**No fact about the school is invented anywhere in this codebase.**

Contact details, motto, history, leadership, subjects, fees and entry
requirements are seeded as empty, clearly-marked placeholders. The admin
dashboard lists every outstanding item under "Complete your site".

### Still required from the school

Postal and physical address · phone · email · mission, vision and values ·
founding history · leadership names, titles and photographs · subjects and
combinations actually offered · entry requirements and required documents ·
fee structure · term dates · social links · map location · official policy text
(privacy, terms, admissions, safeguarding) · **more photography** — sport,
worship, clubs, leadership portraits and classrooms beyond the science
laboratory.

The crest carries wording the school may want as site content — it reads
**TRUTH** and **PHYSICAL, MENTAL AND SPIRITUAL DEV'T**. These have deliberately
*not* been written into the motto setting: reading text off an image is not the
same as the school confirming its official motto.

The ten supplied photographs are a single session and are mapped to specific
places in `packages/db/prisma/seed.ts`; the site is built to read correctly
without leaning on repeated imagery.

## Milestones

1. **Foundation** — database, auth, RBAC, storage, media pipeline, mail, rate
   limiting, design system, seed, first-administrator CLI. ✅
2. **Public website** — site shell, homepage, informational pages, news,
   events, gallery, search, contact form, SEO. ✅
3. **Admissions** — multi-step application wizard, document upload, submission,
   reference numbers, status lookup, applicant portal. ✅
4. **Admin CMS** — the management modules listed in the admin sidebar.
   Applications, Documents, Requirements, Academic years, Hero slides, Media
   library, Pages, News, Events, Gallery, Announcements, Academics, Staff and
   Enquiries ✅ · Site settings, Navigation, Users, Audit log — to do.
5. **Hardening** — security sweep, performance, accessibility, responsive pass.
