# interpreter-marketplace

TypeScript monorepo for an interpreter marketplace MVP.

## Structure

- `apps/web`: Next.js App Router + Tailwind UI + auth/profile/search + dashboards
- `apps/api`: Fastify API with Zod validation, Prisma, JWT auth, RBAC, and Meilisearch-backed search
- `infra/docker-compose.yml`: base services
- `infra/docker-compose.vps.yml`: required VPS overrides (production env, network aliases, restart policy)
- `docs/ops/runbook.md`: deployment + operations runbook

## Required environment variables

Copy `.env.example` to `.env` and set real values:

- `DATABASE_URL`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (example: `1h`)
- `CORS_ORIGINS` (comma-separated production origins)
- `MEILI_MASTER_KEY`

Never commit real secrets.

## Local run

```bash
cd infra
docker compose up --build
```

## VPS deploy (single command)

```bash
cd /opt/interpreter-marketplace
make deploy
```

`make deploy` always uses:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.vps.yml ...
```

The deploy script hard-fails if the VPS override is missing or if the merged config does not include expected proxy aliases.

## Fresh VPS smoke test checklist

1. Clone + env setup:
   - `git clone <repo-url> /opt/interpreter-marketplace`
   - `cp .env.example .env` and fill production values
2. Deploy:
   - `cd /opt/interpreter-marketplace && make deploy`
3. Service health:
   - `docker compose -f infra/docker-compose.yml -f infra/docker-compose.vps.yml ps`
   - `curl -fsS http://localhost:4000/health` (from API container or published gateway endpoint)
4. Minimal journey:
   - signup user (response must not include verification token)
   - verify email + login
   - run search query
   - load dashboard page through gateway

## Security and production defaults

- Signup endpoint does not return verification tokens; token logging is disabled in production.
- JWT signing has explicit expiry (`JWT_EXPIRES_IN`) and consistent verification through Fastify JWT middleware.
- CORS is restricted to `CORS_ORIGINS` in production.
- Meilisearch filter inputs are escaped using helper functions (no raw user string interpolation).

## Next.js build/deploy mode

Web is deployed as SSR (`next build` + `next start`) in Docker Compose.

- No static export mode is used.
- Locale layout is marked dynamic to avoid prerender/export failures when request-scoped i18n APIs are used.
- CI includes a web build step that matches Docker build behavior (`npm run build:web:docker`).

## Ops

See `docs/ops/runbook.md` for:

- deploy / rollback / restart
- logs and health checks
- backups
- disk usage inspection
- safe cache cleanup vs destructive prune commands
- gateway (Caddy) wiring and health verification
