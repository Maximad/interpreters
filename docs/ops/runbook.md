# Interpreter Marketplace operations

## Prepare a VPS deployment

The default checkout is `/opt/interpreters`. The Compose files `infra/docker-compose.yml` and `infra/docker-compose.vps.yml` use the project name `interpreters`, matching Docker Manager. Verify the existing database volume before the first upgrade. If an earlier deployment used a different Compose project name, set `COMPOSE_PROJECT_NAME` in the environment file to reuse that project's volumes.

Create an environment file outside the checkout, for example `/etc/interpreters/interpreters.env`, using `.env.example` as a reference. On an existing deployment, copy its current production settings to this file before switching revisions. Protect it with mode `600` and give the deploy account read access. Preserve its database and Meilisearch credentials unless you rotate them separately.

Set the following in the environment file.

- `DATABASE_URL`, the `POSTGRES_*` settings, `JWT_SECRET`, and the Meilisearch settings
- `IMAGE_API`, `IMAGE_WEB`, and `IMAGE_NGINX` to the selected images for a manual deployment
- `PUBLIC_BASE_URL` to the externally reachable HTTPS origin, such as the temporary hostname
- `SMTP_URL` and `SMTP_FROM` to an authenticated sender, using URL-encoded credentials in the SMTP URL
- `CORS_ORIGINS` for any additional permitted browser origins

Registration and verification resend are available after the public origin and email sender are configured. The browser uses the gateway's relative `/api` path, so hostname changes do not require new images.

For a Hostinger Email mailbox on an existing VPS deployment, run `bash scripts/configure-hostinger-smtp.sh MAILBOX_ADDRESS` in the Web console. It prompts for the password, checks SMTP authentication, and applies the settings to the running API.

## Database upgrades

An empty database applies all migrations and seeds lookup values automatically. A database initialized by an older deployment may already have the schema from `20260217140000_initial`. Back up that database and compare its schema to the migration before marking the baseline applied. If its quote uniqueness index also exists, check whether `20260217150000_quote_request_profile_unique` is already recorded as applied.

Use the candidate release API image to inspect migration status from the target Compose project.

```sh
docker compose --env-file /etc/interpreters/interpreters.env \
  -f infra/docker-compose.yml -f infra/docker-compose.vps.yml \
  run --rm migrate npm exec -- prisma migrate status
```

For an existing schema verified against the baseline, use the same Compose command with `npm exec -- prisma migrate resolve --applied 20260217140000_initial`. Resolve the historical quote index migration separately only if its index already exists and the migration is missing from Prisma's history.

## Gateway and temporary hostname

The shared Caddy proxy terminates TLS and reaches `interpreters-nginx:80` on the external Docker network `proxy`. Port `80` here belongs to the Nginx container. The VPS Compose stack receives HTTP traffic entirely through the gateway. Confirm that the temporary hostname resolves to the gateway and that the gateway can serve it. Set `INTERPRETERS_HOST` in the Caddy environment when importing `infra/Caddyfile.interpreters`, and set the matching HTTPS origin as `PUBLIC_BASE_URL` in the app environment file.

After reloading the gateway, check the home page and `/health` through that origin. The health endpoint checks PostgreSQL and Meilisearch.

## One-time setup from the Hostinger Web console

For a fresh installation, fetch the verified revision into a separate release directory and run `scripts/deploy-web-console.sh HOSTNAME` from the root Web console. It builds the release images, creates a private environment file, and starts the `interpreters` project. After the stack passes its internal health check, the script validates the new site file with the shared Caddy gateway and checks public HTTPS.

The script uses `/etc/caddy/sites/interpreters-temporary.caddy`. If the gateway does not load the site file, the script backs up the mounted Caddyfile and adds an import for that file. The hostname must be available in the gateway. Use the database upgrade instructions when interpreter data or a production environment already exists.

Run `scripts/deploy-web-console.sh HOSTNAME --route-only` to publish a healthy deployment whose environment already uses that HTTPS origin. This mode checks the service from the gateway and applies the route without rebuilding the app.

If the fresh deployment is healthy and its route has yet to be published, run `scripts/deploy-web-console.sh HOSTNAME --set-origin RELEASE_DIR` to publish it with a different hostname. Point DNS at the VPS first. Pass the release directory used for the running images. This mode backs up the app environment, updates its URL and allowed origin, and refreshes the API and Nginx containers from the existing images.

For an existing `interpreters` project installed from the Web console, run `bash scripts/upgrade-web-console.sh` from a clean checkout of the verified release. It checks the API image as its runtime user, backs up PostgreSQL, and applies migrations before switching application containers. Use this path for releases whose database changes also support the running version during the upgrade.

## Verify and deploy

In GitHub Actions, run **CI, Image Publish and VPS Deploy** with `check-vps` for a read-only report of the interpreter checkout and containers. For a verified `main` deployment, choose `deploy-vps`. The workflow builds and verifies the stack, publishes the three images, and deploys those exact digests.

The workflow uses `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, and optionally `VPS_PORT`, `VPS_FINGERPRINT`, and `VPS_APP_DIR`. Set `VPS_ENV_FILE` to the external environment file on that server. A private registry also uses `GHCR_USERNAME` and a read-scoped `GHCR_PAT`.

For a manual deploy, select the release checkout and image digests, then run:

```sh
make deploy ENV_FILE=/etc/interpreters/interpreters.env
```

Retain the previous revision and three image digests. To roll back, select that checkout and those digests, then use the same command. Confirm database compatibility before rolling back an application across a schema change.

For logs, run `make logs ENV_FILE=/etc/interpreters/interpreters.env`.

## Backups and admin access

Run `ENV_FILE=/etc/interpreters/interpreters.env ./scripts/backup.sh` before a database upgrade. The PostgreSQL dump can restore marketplace data. Meilisearch rebuilds its index from approved profiles. Keep verified backup copies off the VPS.

An operator can assign the `ADMIN` role to a verified account in PostgreSQL. The account should sign in again after the role change to receive an updated session. Reviewers land on `/en/admin/profiles`.
