#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR=${PROJECT_DIR:-/opt/interpreter-marketplace}
COMPOSE_FILES="-f infra/docker-compose.yml -f infra/docker-compose.prod.yml"

cd "$PROJECT_DIR"

if [ ! -d .git ]; then
  echo "Project directory is not a git checkout: $PROJECT_DIR" >&2
  exit 1
fi

BRANCH=${BRANCH:-main}

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

# Build images first (idempotent)
docker compose $COMPOSE_FILES build

# Run migrations in one-off API container before service restart.
docker compose $COMPOSE_FILES run --rm api npm run prisma:migrate

# Start or update services after successful migration.
docker compose $COMPOSE_FILES up -d --remove-orphans

# Keep environment tidy.
docker image prune -f >/dev/null 2>&1 || true

echo "Deployment complete for branch: $BRANCH"
