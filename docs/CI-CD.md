# CI/CD

The production workflow lives in `.github/workflows/deploy.yml`. On pushes to
`main`, or when run manually from GitHub Actions, it builds two images and pushes
them to GitHub Container Registry:

- `ghcr.io/<owner>/bass-admin:<commit-sha>`
- `ghcr.io/<owner>/bass-web:<commit-sha>`

It then copies `docker-compose.deploy.yml` to the server, pulls those exact image
tags, runs `npm run db:deploy` in the admin container, and restarts both services.

## GitHub settings

Create these repository or environment secrets:

| Secret | Purpose |
| --- | --- |
| `DEPLOY_HOST` | Server hostname or IP. |
| `DEPLOY_USER` | SSH user that can run Docker. |
| `DEPLOY_SSH_KEY` | Private SSH key for that user. |
| `DEPLOY_PORT` | SSH port, optional; defaults to `22`. |
| `DEPLOY_PATH` | Directory on the server, for example `/srv/bass`. |
| `GHCR_USERNAME` | GitHub user or bot account used by the server to pull images. |
| `GHCR_TOKEN` | Token with permission to read the package images. |

Create this repository or environment variable:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public website origin baked into the client bundle. |

## Server layout

Prepare the deploy directory once:

```bash
mkdir -p /srv/bass/admin /srv/bass/web
```

Put the production environment files on the server:

- `/srv/bass/admin/.env`
- `/srv/bass/web/.env`

Those files are not copied by CI. They should contain the database, storage,
mail, session, and cron secrets described in `docs/DEPLOYMENT.md`. If
`STORAGE_DRIVER=local`, set `STORAGE_LOCAL_DIR=/app/storage` so uploads land in
the shared Docker volume from `docker-compose.deploy.yml`.
