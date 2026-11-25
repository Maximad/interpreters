#!/usr/bin/env bash
set -euo pipefail
umask 077

die() {
  printf 'Upgrade stopped. %s\n' "$*" >&2
  exit 1
}

cd -- "$(dirname -- "$0")/.."
revision=$(git rev-parse HEAD)
git diff --quiet HEAD || die 'The release checkout has tracked changes.'
env_file=/etc/interpreters/interpreters.env
exec 9>/run/lock/interpreters-deploy.lock
flock -n 9 || die 'An interpreter deployment is already running.'

origin=$(sed -n 's/^PUBLIC_BASE_URL=//p' "$env_file")
[[ $origin =~ ^https://[a-zA-Z0-9.-]+$ ]] || die 'The app environment needs a valid HTTPS address.'
volume=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' interpreters-postgres-1)
[[ $volume == interpreters_postgres_data ]] || die 'The expected interpreter database volume was not found.'

for component in api web nginx; do
  case "$component" in
    nginx) dockerfile=infra/nginx.Dockerfile ;;
    *) dockerfile="apps/$component/Dockerfile" ;;
  esac
  image="interpreters-$component:sha-$revision"
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    docker build --label "org.opencontainers.image.revision=$revision" -t "$image" -f "$dockerfile" .
  fi
done

# Verify reads as the same unprivileged user used by the migration.
docker run --rm --entrypoint sh "interpreters-api:sha-$revision" -ec '
  npm pkg get name >/dev/null &&
    test -r prisma/schema.prisma && test -r dist/prisma/seed.js
' || die 'The candidate API image cannot read its migration files.'

mkdir -p /var/backups/interpreters
backup=$(mktemp -d /var/backups/interpreters/upgrade.XXXXXX)
cp -- "$env_file" "$backup/interpreters.env"
docker exec interpreters-postgres-1 sh -ec 'exec pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$backup/database.dump"
docker exec -i interpreters-postgres-1 pg_restore --list < "$backup/database.dump" >/dev/null
printf 'Database backup saved in %s\n' "$backup"

candidate=$(mktemp /etc/interpreters/.release-env.XXXXXX)
trap 'rm -f -- "$candidate"' EXIT
awk -v revision="$revision" '
  !/^IMAGE_(API|WEB|NGINX)=/ { print }
  END {
    print "IMAGE_API=interpreters-api:sha-" revision
    print "IMAGE_WEB=interpreters-web:sha-" revision
    print "IMAGE_NGINX=interpreters-nginx:sha-" revision
  }
' "$backup/interpreters.env" > "$candidate"

mapfile -t compose_env_keys < <(sed -nE 's/^([A-Z][A-Z0-9_]+)=.*/\1/p' .env.example)
compose() (
  unset "${compose_env_keys[@]}"
  docker compose -p interpreters --env-file "$1" -f infra/docker-compose.yml -f infra/docker-compose.vps.yml "${@:2}"
)

start_app() {
  local compose_env=$1
  local args=(up -d --no-deps --no-build --pull never --wait --wait-timeout 240)
  compose "$compose_env" "${args[@]}" api web &&
    compose "$compose_env" "${args[@]}" --force-recreate nginx &&
    compose "$compose_env" exec -T nginx wget -Y off -qO- http://127.0.0.1/health | grep -Fxq '{"status":"ok"}'
}

compose "$candidate" config --quiet
cmp -s "$env_file" "$backup/interpreters.env" || die 'The app environment changed during preparation.'
printf 'Applying database migrations before switching the app\n'
compose "$candidate" up --no-deps --no-build --pull never --exit-code-from migrate migrate ||
  die 'The migration failed before switching the app. See the output above.'

if ! start_app "$candidate"; then
  echo 'Upgrade failed. Restarting the previous app images.' >&2
  start_app "$backup/interpreters.env" || die 'The previous app images need attention.'
  exit 1
fi

mv -T -- "$candidate" "$env_file"
curl -fsS --connect-timeout 5 --max-time 10 "$origin/health"
printf '\nDeployment healthy at %s\n' "$revision"
