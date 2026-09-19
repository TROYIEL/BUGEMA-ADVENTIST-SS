# Bugema Adventist Secondary School (BASS)

Two **independent projects**, side by side. Each has its own `package.json`,
lockfile, `node_modules`, `.env`, `.gitignore`, Prisma schema, tests and
scripts; neither imports a line from the other. They meet only in the
PostgreSQL database and the file storage they both connect to.

| Directory | What it is | Port |
| --- | --- | --- |
| [`admin/`](admin/README.md) | Administration system. **Owns the database**: schema, migrations, seed, CLI scripts. | 3001 |
| [`web/`](web/README.md) | Public website, admissions wizard and applicant portal. | 3000 |

To work on one, `cd` into it and follow its README — `npm install`, `.env`,
`npm run dev`. To set up from nothing, start with `admin/` (it creates and
seeds the database), then `web/`.

Either directory can be moved into its own repository as it is: copy it,
`git init`, done.

```
bass/
  admin/      independent project — see admin/README.md
  web/        independent project — see web/README.md
  docs/       technical summary and deployment runbook covering both
  storage/    local uploads (gitignored); both projects' STORAGE_LOCAL_DIR
              point here when they run on one machine
```

- [docs/TECHNICAL-SUMMARY.md](docs/TECHNICAL-SUMMARY.md) — the brief's
  fifteen points: architecture, routes, data model, auth, roles, admissions
  workflow, CMS, storage, environment, deployment, assumptions, and what is
  still required from the school.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — production runbook.

**No fact about the school is invented anywhere.** Contact details, motto,
history, leadership, subjects, fees and entry requirements are placeholders
until the school supplies them; the administration dashboard lists what is
missing.
