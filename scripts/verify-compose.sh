#!/usr/bin/env bash
set -euo pipefail

COMPOSE_BASE_FILE="infra/docker-compose.yml"
COMPOSE_VPS_FILE="infra/docker-compose.vps.yml"

for compose_file in "$COMPOSE_BASE_FILE" "$COMPOSE_VPS_FILE"; do
  if [ ! -f "$compose_file" ]; then
    echo "Required compose file is missing: $compose_file" >&2
    exit 1
  fi
done

rendered_file=$(mktemp)
trap 'rm -f "$rendered_file"' EXIT

docker compose -f "$COMPOSE_BASE_FILE" -f "$COMPOSE_VPS_FILE" config > "$rendered_file"

grep -q "interpreters-nginx" "$rendered_file"

echo "Compose configuration is valid and gateway proxy alias is present."
