#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR=${PROJECT_DIR:-/opt/interpreters}
BRANCH=${BRANCH:-main}
COMPOSE_BASE_FILE="infra/docker-compose.yml"
COMPOSE_VPS_FILE="infra/docker-compose.vps.yml"

cd "$PROJECT_DIR"

if [ ! -d .git ]; then
  echo "Project directory is not a git checkout: $PROJECT_DIR" >&2
  exit 1
fi

for compose_file in "$COMPOSE_BASE_FILE" "$COMPOSE_VPS_FILE"; do
  if [ ! -f "$compose_file" ]; then
    echo "Required compose file is missing: $compose_file" >&2
    exit 1
  fi
done

compose() {
  docker compose -f "$COMPOSE_BASE_FILE" -f "$COMPOSE_VPS_FILE" "$@"
}

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

# Render merged compose and fail early if override aliases are absent.
if ! compose config > /tmp/interpreters.compose.rendered.yml; then
  echo "docker compose config failed; refusing deploy" >&2
  exit 1
fi

if ! grep -q "interpreters-nginx" /tmp/interpreters.compose.rendered.yml; then
  echo "Compose config is missing the interpreters-nginx proxy alias; refusing deploy" >&2
  exit 1
fi

compose pull
compose run --rm migrate
compose up -d --remove-orphans

docker image prune -f >/dev/null 2>&1 || true

echo "Deployment complete for branch: $BRANCH"
