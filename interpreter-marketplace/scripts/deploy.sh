#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR=${PROJECT_DIR:-/opt/interpreter-marketplace}
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
if ! compose config > /tmp/interpreter-marketplace.compose.rendered.yml; then
  echo "docker compose config failed; refusing deploy" >&2
  exit 1
fi

if ! grep -q "interpreters-web" /tmp/interpreter-marketplace.compose.rendered.yml || \
   ! grep -q "interpreters-api" /tmp/interpreter-marketplace.compose.rendered.yml; then
  echo "VPS override did not apply expected proxy aliases; refusing deploy" >&2
  exit 1
fi

compose build
compose run --rm api npm run prisma:migrate
compose up -d --build --remove-orphans

docker image prune -f >/dev/null 2>&1 || true

echo "Deployment complete for branch: $BRANCH"
