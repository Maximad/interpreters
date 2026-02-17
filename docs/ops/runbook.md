# Operations runbook (VPS + Docker Compose)

## Deployment model

This project deploys with an **image-only compose pair**:

- `infra/docker-compose.yml` (base, image references, healthchecks, proxy network)
- `infra/docker-compose.vps.yml` (optional VPS resource overrides)

The deploy script validates both files, renders merged config, pulls images, runs migrations, and starts services.

## Fresh VPS deploy (single command)

1. Clone and configure env:

```bash
git clone <repo-url> /opt/interpreters
cd /opt/interpreters
cp .env.example .env
# fill all required variables
```

2. Run deploy:

```bash
make deploy
```

This executes pull/reset, compose config sanity check, image pull, migration run (`migrate` service), and `up -d --remove-orphans`.

## Health checks

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.vps.yml ps
docker compose -f infra/docker-compose.yml -f infra/docker-compose.vps.yml exec api wget -qO- http://localhost:4000/health
```

Gateway-level check:

```bash
curl -fsS https://<your-domain>/health
```

## Logs

```bash
make logs
# or targeted:
docker compose -f infra/docker-compose.yml -f infra/docker-compose.vps.yml logs -f nginx api web postgres redis meilisearch
```

## Restart / rollback

Restart current revision:

```bash
make restart
```

Rollback to previous git commit:

```bash
cd /opt/interpreters
git log --oneline -n 5
git reset --hard <previous_commit_sha>
make deploy
```

## Backups

```bash
PROJECT_DIR=/opt/interpreters ./scripts/backup.sh
```

Restore uses standard PostgreSQL dump restore into the `postgres` service.

## Gateway / TLS notes

TLS termination is handled by the **existing VPS gateway proxy**.

- Domain: `APP_DOMAIN` / your configured host
- Upstream service: `interpreters-nginx`
- Upstream port: `8080`
- TLS: terminated at gateway, backend traffic on Docker network

Use `infra/Caddyfile.interpreters` as a reference route:

```caddy
interpreters.jwtalenthouse.com {
  reverse_proxy interpreters-nginx:8080
}
```
