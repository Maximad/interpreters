# Operations runbook (VPS + Docker Compose)

## Deployment model

This project deploys with a **required compose pair**:

- `infra/docker-compose.yml` (base)
- `infra/docker-compose.vps.yml` (VPS overrides)

The deploy script validates both files, renders merged config, and checks proxy aliases before deploy.

## Fresh VPS deploy (single command)

1. Clone and configure env:

```bash
git clone <repo-url> /opt/interpreter-marketplace
cd /opt/interpreter-marketplace
cp .env.example .env
# fill all required variables
```

2. Run deploy:

```bash
make deploy
```

This executes pull/reset, compose config sanity check, build, Prisma migrations, and `up -d --build --remove-orphans`.

## Health checks

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.vps.yml ps
docker compose -f infra/docker-compose.yml -f infra/docker-compose.vps.yml exec api wget -qO- http://localhost:4000/health
```

If you use an external Caddy gateway, verify proxy upstreams from the gateway container/network can resolve `interpreters-web` and `interpreters-api`.

## Logs

```bash
make logs
# or targeted:
docker compose -f infra/docker-compose.yml -f infra/docker-compose.vps.yml logs -f api web postgres meilisearch
```

## Restart / rollback

Restart current revision:

```bash
make restart
```

Rollback to previous git commit:

```bash
cd /opt/interpreter-marketplace
git log --oneline -n 5
git reset --hard <previous_commit_sha>
make deploy
```

## Backups

```bash
PROJECT_DIR=/opt/interpreter-marketplace ./scripts/backup.sh
```

Restore uses standard PostgreSQL dump restore into the `postgres` service.

## Disk usage reality

Deleting `/opt/interpreter-marketplace` **does not remove** system packages like Docker Engine, Node, npm, or system logs.

The main long-term disk consumers are usually:
- Docker images/layers
- BuildKit cache
- Container logs
- Named volumes (especially Postgres data)

Check usage:

```bash
df -h
docker system df -v
```

## Safe cleanup (does NOT remove volumes/database)

```bash
make prune-cache
# equivalent:
docker builder prune -f
# optional wider cache cleanup:
docker buildx prune -f
```

## Aggressive cleanup (can delete volumes / DB data)

⚠️ **Destructive**: only run if you accept data loss for unnamed + optionally named volumes.

```bash
docker system prune -a --volumes
```

## Gateway / Caddy notes

If the VPS uses a host-level Caddy gateway, use `infra/Caddyfile.interpreters` and route:
- `/api/*` -> `interpreters-api:4000`
- `/health` -> `interpreters-api:4000/health`
- `/` -> `interpreters-web:3000`

After reload, verify with a gateway-side health request:

```bash
curl -fsS https://<your-domain>/health
```
