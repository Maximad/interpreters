#!/usr/bin/env bash
set -euo pipefail
umask 077

die() {
  printf 'Web rollout stopped. %s\n' "$*" >&2
  exit 1
}

exec 9>/run/lock/interpreters-deploy.lock
flock -n 9 || die 'Another interpreter deployment is running.'
im_rev=${1:-}
im_heading=${2:-}
im_asset=${3:-}
if [[ ! $im_rev =~ ^[0-9a-f]{40}$ || -z $im_heading || $im_asset != /* ]]; then
  printf 'Usage: %s RELEASE_SHA HOME_HEADING ASSET_PATH\n' "$0" >&2
  exit 1
fi
im_env=/etc/interpreters/interpreters.env
im_image="interpreters-web:sha-$im_rev"
im_registry="ghcr.io/maximad/interpreters/web:sha-$im_rev"
im_root=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' interpreters-web-1) ||
  die 'Could not inspect the existing interpreter web container.'
[[ $im_root == /* && -d $im_root ]] || die 'The running web container has no valid Compose working directory.'
# Compose uses the first configuration file's directory by default.
if [[ ! -f "$im_root/infra/docker-compose.yml" &&
      -f "$im_root/docker-compose.yml" && -f "$im_root/docker-compose.vps.yml" ]]; then
  im_root=$(dirname -- "$im_root")
fi
cd -- "$im_root" || die 'The interpreter checkout directory could not be opened.'
[[ -f infra/docker-compose.yml && -f infra/docker-compose.vps.yml && -f .env.example ]] ||
  die 'The interpreter Compose files could not be located.'
[[ -r $im_env ]] || die 'The interpreter environment file could not be read.'
im_origin=$(sed -n 's/^PUBLIC_BASE_URL=//p' "$im_env")
[[ $im_origin =~ ^https://[a-zA-Z0-9.-]+$ ]] || die 'The interpreter environment needs a valid HTTPS address.'
[[ $(grep -c '^IMAGE_WEB=' "$im_env") -eq 1 ]] || die 'The interpreter environment needs exactly one IMAGE_WEB setting.'

if ! docker image inspect "$im_image" >/dev/null 2>&1; then
  if docker pull "$im_registry" &&
     [[ $(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$im_registry") == "$im_rev" ]]; then
    docker tag "$im_registry" "$im_image"
  else
    mkdir -p /opt/interpreters-releases
    im_source=$(mktemp -d "/opt/interpreters-releases/${im_rev}.XXXXXX")
    (
      umask 022
      git -C "$im_source" init -q
      git -C "$im_source" fetch -q --depth=1 https://github.com/Maximad/interpreters.git "$im_rev"
      git -C "$im_source" switch -q --detach "$im_rev"
    )
    docker build --label "org.opencontainers.image.revision=$im_rev" -t "$im_image" -f "$im_source/apps/web/Dockerfile" "$im_source"
  fi
fi

im_prev=$(mktemp "$im_env.before-web.XXXXXX")
cp -- "$im_env" "$im_prev"
im_next=$(mktemp "$im_env.web.XXXXXX")
im_page=$(mktemp)
trap 'rm -f -- "$im_next" "$im_page"' EXIT
sed "s|^IMAGE_WEB=.*|IMAGE_WEB=$im_image|" "$im_prev" > "$im_next"

compose() (
  mapfile -t im_compose_keys < <(sed -nE 's/^([A-Z][A-Z0-9_]+)=.*/\1/p' .env.example)
  unset "${im_compose_keys[@]}"
  docker compose -p interpreters --env-file "$1" -f infra/docker-compose.yml -f infra/docker-compose.vps.yml "${@:2}"
)
switch_web() {
  compose "$1" up -d --no-deps --no-build --pull never --wait --wait-timeout 120 web &&
    compose "$1" exec -T nginx nginx -s reload
}
verify_web() {
  for attempt in {1..6}; do
    if curl -fsSL --connect-timeout 4 --max-time 8 -o "$im_page" "$im_origin/en" &&
       grep -Fq -- "$im_heading" "$im_page" &&
       curl -fsS --connect-timeout 4 --max-time 8 -o /dev/null "$im_origin$im_asset" &&
       curl -fsS --connect-timeout 4 --max-time 8 "$im_origin/health" | grep -Fxq '{"status":"ok"}'; then
      return 0
    fi
    sleep 2
  done
  return 1
}

compose "$im_next" config --quiet
cmp -s "$im_env" "$im_prev" || die 'The interpreter environment changed during preparation.'
if ! switch_web "$im_next" || ! verify_web; then
  echo 'The new homepage could not be verified. Restoring the previous web image.' >&2
  switch_web "$im_prev"
  exit 1
fi
mv -T -- "$im_next" "$im_env"
printf 'Web release live at %s/ (%s)\n' "$im_origin" "$im_rev"
