# interpreter-marketplace

TypeScript monorepo for an interpreter marketplace MVP.

## Structure

- `apps/web`: Next.js App Router + Tailwind UI + auth/profile/search + client/interpreter dashboards
- `apps/api`: Fastify API with Zod validation, Prisma, JWT auth, RBAC, Meilisearch-backed search, request/quote workflows
- `infra/docker-compose.yml`: local stack
- `infra/docker-compose.prod.yml`: production override (restart policies + resource limits)
- `infra/nginx.prod.conf`: HTTPS reverse-proxy config for VPS

## Run locally

```bash
cd infra
docker compose up --build
```

- Web app: http://localhost
- API health: http://localhost/health

## VPS production deployment (Hostinger)

### 1) One-time server setup

```bash
sudo mkdir -p /opt/interpreter-marketplace
sudo chown -R $USER:$USER /opt/interpreter-marketplace
git clone <your-repo-url> /opt/interpreter-marketplace
cd /opt/interpreter-marketplace
cp .env.example .env   # fill with production secrets
```

Set production environment values in `.env` (at minimum):

- `DATABASE_URL`
- `JWT_SECRET`
- `MEILI_MASTER_KEY`
- `CORS_ORIGINS` (comma-separated, e.g. `https://your-domain.com,https://www.your-domain.com`)

Copy logrotate config once:

```bash
sudo cp ops/logrotate/interpreter-marketplace /etc/logrotate.d/interpreter-marketplace
sudo chmod 644 /etc/logrotate.d/interpreter-marketplace
```

Install daily backup cron:

```bash
PROJECT_DIR=/opt/interpreter-marketplace ./scripts/setup-cron.sh
```

### 2) TLS certificates

Update `infra/nginx.prod.conf` domain (`interpreter-marketplace.example.com`) to your real domain.
Then run certbot (first-time issuance):

```bash
cd infra
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.vps.yml up -d nginx
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.vps.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d your-domain.com \
  --email you@example.com --agree-tos --no-eff-email
```

### 3) Idempotent deploy command (safe migrations)

```bash
cd /opt/interpreter-marketplace
./scripts/deploy.sh
```

`deploy.sh` is idempotent and performs:
1. `git fetch/reset` to `origin/main`
2. `docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml -f infra/docker-compose.vps.yml build`
3. `prisma migrate deploy` in a one-off API container (before restart)
4. `docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml -f infra/docker-compose.vps.yml up -d --remove-orphans`

### 4) Post-deploy verification

Confirm VPS network aliases resolve and both app services are healthy:

```bash
cd /opt/interpreter-marketplace
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml -f infra/docker-compose.vps.yml exec nginx getent hosts interpreters-web interpreters-api
```

## GitHub Actions CI/CD

Workflow: `.github/workflows/ci-cd.yml`

- On push to `main`: install deps, generate Prisma client, run build.
- If successful: deploys over SSH to Hostinger and executes `./scripts/deploy.sh`.

Required GitHub secrets:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_PORT` (optional)
- `VPS_PROJECT_DIR` (e.g. `/opt/interpreter-marketplace`)

## Backups and logs

- Manual backup:

```bash
PROJECT_DIR=/opt/interpreter-marketplace ./scripts/backup.sh
```

- Default backup retention: 14 days (`RETENTION_DAYS`).
- Log rotation handled by `ops/logrotate/interpreter-marketplace`.


## Web i18n (next-intl)

- Locale routing lives in `apps/web/i18n/routing.ts` and middleware in `apps/web/middleware.ts`.
- Translation files are under `apps/web/messages/{locale}.json`.
- Missing keys automatically fall back to English using deep-merge logic in `apps/web/i18n/request.ts`.

### Add a new locale

1. Add locale code to `locales` in `apps/web/i18n/routing.ts`.
2. Create `apps/web/messages/<locale>.json` (copy from `en.json` as starter).
3. Add display label in `apps/web/components/language-switcher.tsx`.
4. Verify RTL behavior if needed by updating `isRtl` in `apps/web/app/[locale]/layout.tsx`.
