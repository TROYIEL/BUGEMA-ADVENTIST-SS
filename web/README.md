# BASS — Public website

The public website of Bugema Adventist Secondary School, with the online
admissions wizard and the applicant portal. It reads its content from the
database and writes what visitors and applicants produce: applications,
uploaded documents, enquiries, queued email.

The database is **created, migrated and seeded by the separate
administration project**; this one connects to it and to the same file
storage. Nothing is shared between the two codebases.

Runs on <http://localhost:3000>.

## Requirements

- Node.js 20.19+ (developed on 22.x)
- A PostgreSQL database that the administration project has migrated and
  seeded — a local Docker one or a hosted one such as Neon
- Google Chrome, only for `npm run test:e2e`

## Running locally

```bash
npm install                   # also generates the Prisma client
cp .env.example .env          # DATABASE_URL, SESSION_SECRET, STORAGE_LOCAL_DIR
npm run dev                   # http://localhost:3000
```

`.env` is read from this directory. Two values must agree with the
administration project's: `DATABASE_URL` (the same database — on Neon, the
*pooled* connection string) and the file storage. A relative
`STORAGE_LOCAL_DIR` means a directory under *this project*, so when both
projects run on one machine with the local driver, **give both the same
absolute path** (or use the S3 driver). `SESSION_SECRET` is this project's
own: it signs applicant cookies.

Against an empty database the site renders correctly but empty: run the
administration project's `db:migrate` and `db:seed` first.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | The site on port 3000 |
| `npm run lint` / `typecheck` | ESLint; `next typegen` then `tsc --noEmit` |
| `npm test` | Unit and database tests (`src/**/*.test.ts`; needs `DATABASE_URL`) |
| `npm run test:e2e` | Smoke, accessibility (axe-core) and responsive checks against a running dev server; read-only |
| `npm run db:generate` | Regenerate the Prisma client into `src/generated/` |

## Layout

```
web/
  prisma/
    schema.prisma       an identical copy of the administration project's schema,
                        used only to generate this project's client (no migrations)
  scripts/e2e/          smoke + a11y suites and the runner
  src/
    app/                routes: (site)/…, sitemap.ts, robots.ts, opengraph-image.tsx
    components/         site shell, sections, cards, gallery, SEO (JSON-LD)
    components/ui/      primitives and design tokens (tokens.css)
    lib/                content queries, admissions, mail, storage, search, settings
    lib/db/             Prisma client factory, singleton, .env loading
    lib/auth/           applicant cookies and the crypto they need
    generated/          Prisma client (gitignored; `npm run db:generate`)
  prisma.config.ts  .env.example
```

There is no administration code here at all — no login form, no dashboard,
no permission table. `/admin` and `/login` are 404s, and the smoke test
checks that they stay so.

## Architecture

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16, App Router, React Server Components, Server Actions |
| Styling | Tailwind CSS v4, tokens in `src/components/ui/tokens.css` |
| Database | PostgreSQL via Prisma 7 with the `pg` driver adapter |
| Validation | Zod, one schema per wizard step shared by client and server |
| Applicants | No accounts — a signed draft cookie and a short-lived portal claim |
| File storage | `StorageAdapter` with `local` and `s3` drivers (`src/lib/storage.ts`) |
| Email | Recorded in `email_outbox` before delivery; `outbox` / `console` / `smtp` drivers |
| Search | PostgreSQL full-text over the index the administration project maintains |
| SEO | Per-page metadata, `sitemap.xml`, `robots.txt`, JSON-LD (School, WebSite, NewsArticle, Event), a generated Open Graph image with the crest |

### The homepage is laid out in code

There is no section builder. The order of the homepage bands — hero, quick
actions, feature grid, featured story, programme cards, highlights, news and
events, admissions call to action — is fixed in
`src/app/(site)/page.tsx`, and each band reads its content from the
database. Each renders nothing when it has no content, so an empty database
gives a short, correct page rather than a row of blank cards. The hero uses
the slides composed in the administration system when at least one is live;
otherwise it assembles its own from settings, the admissions window, the
latest story and the next event.

### Admissions

Applicants have no accounts. Two cookies stand in for one, both issued from
`src/lib/auth/applicant.ts`:

- **Draft** (`bass_application_draft`, 30 days) holds the resume secret for
  an unfinished application; only its SHA-256 is stored. "Email me a link to
  continue" and the confirmation email's access link both land on a Route
  Handler that swaps the token in the URL for a cookie and redirects, so
  secrets never sit in browser history.
- **Portal** (`bass_applicant`, 2 hours) is a signed, expiring claim to one
  submitted application — HMAC-SHA256 over `id:expiry` with `SESSION_SECRET`.
  Stateless, so rotating the secret signs every applicant out. Issued after a
  reference + surname + date of birth lookup (rate limited, same reply
  whichever field was wrong) or an emailed access link.

The wizard is `src/app/(site)/admissions/apply/[step]`. Steps come from the
`ApplicationStep` enum; "additional" only appears when the school has
configured extra questions, and "documents" only when there are document
types for the level applied for — both configured in the administration
system and read live. Every step is a plain `<form action>` to a Server
Action, so it works without JavaScript. The action never trusts the body for
*which* application is being edited — that comes from the cookie — and
re-validates everything from the stored row at submission.

Submission (`finaliseSubmission` in `src/lib/applications.ts`) is one atomic
SQL statement: lock the draft only if it is still a draft, bump the per-year
counter, write the reference (`BASS-2026-000123`), the status and the history
event together. Concurrent submissions get consecutive numbers, a double
click cannot submit twice, and a failed submission burns no number. Mail is
queued *after* it — an SMTP outage must not undo a submission.

Documents are re-encoded (`processUploadedDocument`: metadata stripped, PDFs
byte-identical), stored PRIVATE, and served to their owner only by
`admissions/application-status/documents/[id]`, which answers 404 for anyone
else's. Uploads go through a Server Action, so `serverActions.bodySizeLimit`
in `next.config.ts` is raised to 10 MB against the 8 MB ceiling in
`MAX_DOCUMENT_BYTES`.

### Design language

Adapted from the University of Kent's site as a UX benchmark — its structure
and interaction patterns, not its branding, copy, imagery or markup — in a
navy-and-gold identity taken from the school's own crest. Recurring devices:
a gold parallelogram marking the priority navigation item; angled edges
between full-bleed bands; rotated photographs with gold borders in the hero;
a three-column mega-menu; pill buttons with a circular arrow that shifts
right on hover, filling left to right (`src/components/ui/hover-fill.tsx`).
The mega-menu opens on hover with intent timing and on click, and stays
mounted but `inert` while closed. Every animation is disabled under
`prefers-reduced-motion`.

### Security

- Starting an application, uploading a document, submitting, requesting a
  resume link, exchanging an emailed token and looking up an application are
  each rate limited (`RATE_LIMITS` in `src/lib/rate-limit.ts`, backed by the
  database so it holds across instances).
- Uploads are validated by magic bytes, not filename or `Content-Type`; SVG
  is rejected. Files live outside `public/` and are served by route
  handlers that decide visibility.
- Rich text from the database is sanitised again on render.
- Every response carries HSTS, `nosniff`, `X-Frame-Options: DENY`, a referrer
  policy and a permissions policy. There is no Content-Security-Policy yet;
  it needs per-request nonces and is the next hardening step.

### Notes for anyone extending this

Next.js 16 differs from most published examples: `params`, `searchParams`,
`cookies()` and `headers()` are **Promises**; `revalidateTag` needs a profile
argument; `<Image priority>` is `preload` and `images.qualities` must list
every quality used; route types are generated, so run `npm run typecheck`
after adding a route. Prisma 7: the generator is `prisma-client` with a
required `output` (here `src/generated/prisma`), the datasource URL lives in
`prisma.config.ts`, and a driver adapter is mandatory.

Tailwind v4 traps already hit: `translate-*` compiles to the CSS `translate`
property (transition that, not `transform`); `tailwind-merge` must be told
about the custom `--text-display-*` sizes (`src/components/ui/cn.ts`,
guarded by `cn.test.ts`); hover styles sit inside `@media (hover: hover)`,
which headless Chrome does not match unless launched with the blink flags in
`scripts/e2e/lib/browser.mjs`.

`cacheComponents` is deliberately off: pages that read the database use
`export const dynamic = "force-dynamic"`, so edits made in the administration
system appear immediately and `next build` needs no reachable database.

Navigations animate through React's `<ViewTransition>` (`(site)/template.tsx`
re-mounts per route: old page out, new page in) with a gold progress bar
along the top while the next page loads (`components/site/navigation-progress.tsx`).
There is deliberately **no route-level `loading.tsx`**: a streamed Suspense
fallback fixes the status at 200 before `notFound()` can run, turning every
unknown URL into a soft 404. Instead the news, events and gallery pages
render their header at once and stream the list behind a card skeleton
(`components/site/list-skeleton.tsx`) from a boundary *inside* the page, so
404s stay real. Animation CSS is in `src/components/ui/tokens.css`.

**Keeping the two projects in step.** When the administration project
changes `prisma/schema.prisma`, copy the file here unchanged and run
`npm run db:generate`. Tests only ever touch rows they created (prefixed
`zz-`) and clean up afterwards — the database may be in use by someone else.

## Content policy

No fact about the school is invented anywhere in this codebase. Where the
school has not yet supplied a value the site leaves it out ("Contact details
coming soon") rather than inventing one; the administration system's
dashboard lists what is still missing.
