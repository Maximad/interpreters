#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd -- "$(dirname -- "$0")/.." && pwd)
cd "${PROJECT_DIR:-$project_dir}"
env_file=${ENV_FILE:-.env}

if [ ! -r "$env_file" ]; then
  echo "Cannot read the deployment environment file: $env_file" >&2
  exit 1
fi

compose() {
  docker compose --env-file "$env_file" -f infra/docker-compose.yml -f infra/docker-compose.vps.yml "$@"
}

compose config --quiet
compose pull
compose up -d --wait --wait-timeout 240
compose exec -T nginx wget -Y off -qO- http://127.0.0.1/health
echo
echo "Deployment healthy at $(git rev-parse --short HEAD)"
