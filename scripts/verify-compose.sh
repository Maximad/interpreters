#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "$0")/.."
docker compose --env-file "${ENV_FILE:-.env.example}" -f infra/docker-compose.yml -f infra/docker-compose.vps.yml config --quiet
