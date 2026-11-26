#!/usr/bin/env bash
set -euo pipefail
umask 077

project_dir=$(cd -- "$(dirname -- "$0")/.." && pwd)
cd "${PROJECT_DIR:-$project_dir}"
env_file=${ENV_FILE:-.env}
backup_dir=${BACKUP_DIR:-/var/backups/interpreters}
retention_days=${RETENTION_DAYS:-14}
timestamp=$(date +%Y%m%d-%H%M%S)

mkdir -p "$backup_dir/db"
dump=$(mktemp "$backup_dir/db/.postgres-$timestamp.XXXXXX")
trap 'rm -f "$dump"' EXIT

docker compose --env-file "$env_file" -f infra/docker-compose.yml -f infra/docker-compose.vps.yml \
  exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$dump"
mv "$dump" "$backup_dir/db/postgres-$timestamp.sql.gz"

tar -czf "$backup_dir/app-config-$timestamp.tar.gz" \
  infra/docker-compose.yml infra/docker-compose.vps.yml infra/Caddyfile.interpreters \
  -C "$(dirname "$env_file")" "$(basename "$env_file")"

find "$backup_dir" -type f -mtime +"$retention_days" -delete
echo "Backup completed at $timestamp"
