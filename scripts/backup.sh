#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR=${PROJECT_DIR:-/opt/interpreters}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/interpreters}
RETENTION_DAYS=${RETENTION_DAYS:-14}
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR" "$BACKUP_DIR/db" "$BACKUP_DIR/meili"
cd "$PROJECT_DIR"

COMPOSE_FILES="-f infra/docker-compose.yml -f infra/docker-compose.prod.yml"

# Postgres backup (compressed custom format)
docker compose $COMPOSE_FILES exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip > "$BACKUP_DIR/db/postgres-$TIMESTAMP.sql.gz"

# Meilisearch snapshot export (best-effort)
curl -s -X POST "${MEILISEARCH_URL:-http://127.0.0.1:7700}/snapshots" \
  -H "Authorization: Bearer ${MEILI_MASTER_KEY:-}" \
  -H 'Content-Type: application/json' >/dev/null || true

# Archive app env/config files for disaster recovery
tar -czf "$BACKUP_DIR/app-config-$TIMESTAMP.tar.gz" \
  infra/docker-compose.yml infra/docker-compose.prod.yml infra/nginx.prod.conf .env || true

# Retention policy
find "$BACKUP_DIR" -type f -mtime +"$RETENTION_DAYS" -delete

echo "Backup completed at $TIMESTAMP"
