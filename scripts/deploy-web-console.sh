#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

die() {
  printf 'Deployment stopped. %s\n' "$*" >&2
  exit 1
}

site_host=${1:-}
mode=${2:-}
[[ ( $# -eq 1 || ( $# -eq 2 && $mode == --route-only ) || ( $# -eq 3 && $mode == --set-origin ) ) &&
   $site_host =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ && $site_host == *.* && $site_host != *..* ]] ||
  die "Use deploy-web-console.sh HOSTNAME [--route-only | --set-origin RELEASE_DIR]."
origin="https://$site_host"

gateway=gateway-caddy-1
caddyfile=/etc/caddy/Caddyfile
env_file=/etc/interpreters/interpreters.env
exec 9>/run/lock/interpreters-deploy.lock
flock -n 9 || die "An interpreter deployment is already running."

sites_dir=$(docker inspect "$gateway" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/sites"}}{{.Source}}{{end}}{{end}}')
[[ -d "$sites_dir" ]] || die "Caddy's site directory mount could not be located."
docker network inspect proxy >/dev/null
docker inspect "$gateway" --format '{{range $name, $config := .NetworkSettings.Networks}}{{println $name}}{{end}}' |
  grep -Fxq proxy || die "The gateway needs to be on the proxy network."

work_dir=$(mktemp -d)
route_file="$sites_dir/interpreters-temporary.caddy"
route_installed=false
route_loaded=false
caddyfile_source=
caddyfile_changed=false
caddyfile_backup=
temp_site=
temp_env=
cleanup() {
  if ! $route_loaded; then
    if $caddyfile_changed && ! cat -- "$caddyfile_backup" > "$caddyfile_source"; then
      printf 'Restore the gateway configuration from %s.\n' "$caddyfile_backup" >&2
      return
    fi
    if $route_installed && cmp -s "$work_dir/site" "$route_file"; then
      rm -- "$route_file"
    fi
  fi
  if [[ -n "$temp_env" ]]; then rm -f -- "$temp_env"; fi
  if [[ -n "$temp_site" ]]; then rm -f -- "$temp_site"; fi
  rm -r -- "$work_dir"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
printf '%s {\n  reverse_proxy interpreters-nginx:80\n}\n' "$site_host" > "$work_dir/site"

check_health() {
  python3 -c '
import json
import sys

try:
    response = json.load(sys.stdin)
except ValueError:
    sys.exit(1)
sys.exit(not isinstance(response, dict) or response.get("status") != "ok")
'
}

capture_gateway() {
  docker exec "$gateway" caddy adapt --config "$caddyfile" --adapter caddyfile > "$work_dir/base.json"
  docker exec "$gateway" wget -Y off -qO- http://127.0.0.1:2019/config/ > "$work_dir/active.json"
}

check_gateway() {
  python3 - "$work_dir" "$site_host" "$1" <<'PY'
import fnmatch
import json
from pathlib import Path
import sys

directory, hostname, stage = sys.argv[1:]
directory = Path(directory)

def load(name):
    with (directory / name).open() as stream:
        return json.load(stream)

def objects(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from objects(child)

active = load("active.json")
base = load("base.json")
if active != base:
    sys.exit("Caddy's runtime config differs from its file config. Review the gateway before reloading.")

config = load("candidate.json") if stage == "candidate" else base
http = config.get("apps", {}).get("http", {})
matches = [
    (route, pattern.lower()) for route in objects(http)
    for matcher in route.get("match", [])
    for pattern in matcher.get("host", [])
    if fnmatch.fnmatchcase(hostname, pattern.lower())
]
if stage == "free":
    if matches:
        sys.exit("The temporary hostname already matches a gateway route.")
elif len(matches) != 1 or matches[0][1] != hostname or not any(
    item.get("dial") == "interpreters-nginx:80" for item in objects(matches[0][0])
):
    sys.exit("Caddy's imported configuration did not contain the expected interpreter route.")
PY
}

capture_gateway
if [[ -e "$route_file" ]]; then
  cmp -s "$route_file" "$work_dir/site" || die "The interpreter site file is already in use."
  check_gateway existing
else
  check_gateway free
fi

if [[ $mode != --route-only ]]; then
  if [[ $mode == --set-origin ]]; then
    project_root=$3
  else
    project_root=$(cd -- "$(dirname -- "$0")/.." && pwd)
  fi
  cd "$project_root"
  revision=$(git rev-parse HEAD)
  git diff --quiet HEAD || die "The release checkout has tracked changes."
  env_marker="# Initialized by deploy-web-console.sh at $revision"

  mapfile -t compose_env_keys < <(sed -nE 's/^([A-Z][A-Z0-9_]+)=.*/\1/p' .env.example)
  compose() (
    unset "${compose_env_keys[@]}"
    IMAGE_API="interpreters-api:sha-$revision" IMAGE_WEB="interpreters-web:sha-$revision" IMAGE_NGINX="interpreters-nginx:sha-$revision" \
      docker compose -p interpreters --env-file "$env_file" -f infra/docker-compose.yml -f infra/docker-compose.vps.yml "$@"
  )
fi

apply_api_environment() {
  compose config --quiet &&
    compose up -d --no-deps --no-build --pull never --wait --wait-timeout 90 api &&
    # Nginx resolves the API address at startup.
    compose up -d --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 90 nginx
}

if [[ $mode == --set-origin ]]; then
  grep -Fxq "$env_marker" "$env_file" ||
    die "The supplied release does not match the environment for the running deployment."
  api_image=$(docker inspect interpreters-api-1 --format '{{.Config.Image}}')
  [[ "$api_image" == "interpreters-api:sha-$revision" ]] ||
    die "The running API image does not match the supplied release."
  old_origin=$(sed -n 's/^PUBLIC_BASE_URL=//p' "$env_file")
  [[ -n "$old_origin" ]] && grep -Fxq "CORS_ORIGINS=$old_origin" "$env_file" ||
    die "The app's URL and allowed origins need review before changing the hostname."

  temp_env=$(mktemp "${env_file}.XXXXXX")
  awk -v origin="$origin" '
    /^PUBLIC_BASE_URL=/ { public_count++; $0 = "PUBLIC_BASE_URL=" origin }
    /^CORS_ORIGINS=/ { cors_count++; $0 = "CORS_ORIGINS=" origin }
    { print }
    END { if (public_count != 1 || cors_count != 1) exit 1 }
  ' "$env_file" > "$temp_env" || die "Expected one setting each for PUBLIC_BASE_URL and CORS_ORIGINS."

  env_backup=
  if ! cmp -s "$temp_env" "$env_file"; then
    env_backup=$(mktemp "${env_file}.origin-backup.XXXXXX")
    cp -- "$env_file" "$env_backup"
    mv -T -- "$temp_env" "$env_file"
    printf 'Saved the previous app environment to %s\n' "$env_backup"
  fi

  if ! apply_api_environment; then
    if [[ -n "$env_backup" ]]; then
      cp -- "$env_backup" "$temp_env"
      mv -T -- "$temp_env" "$env_file"
      apply_api_environment || die "The prior environment was restored. Check the API and Nginx containers."
    fi
    die "The interpreter API could not start with the requested URL."
  fi
elif [[ $mode != --route-only ]]; then
  if [[ -e "$env_file" ]]; then
    grep -Fxq "$env_marker" "$env_file" && grep -Fxq "PUBLIC_BASE_URL=$origin" "$env_file" ||
      die "There is an existing interpreter environment. Use the upgrade instructions for existing data."
  else
    old_env=/opt/interpreters/.env
    if [[ -e "$old_env" ]]; then
      python3 - "$old_env" <<'PY'
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit

database_url = ""
for line in Path(sys.argv[1]).read_text().splitlines():
    match = re.match(r"^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.+)$", line)
    if match:
        database_url = match[1].strip().strip("\"'")

if database_url:
    try:
        target = urlsplit(database_url)
        local = target.scheme in {"postgres", "postgresql"} and target.hostname == "postgres"
    except ValueError:
        local = False
    if not local or "${" in database_url:
        sys.exit("The older database target needs review before initializing a fresh database.")
PY
    fi
    volumes=$(docker volume ls --format '{{.Name}}')
    project_volumes=$(docker volume ls -q --filter label=com.docker.compose.project=interpreters)
    containers=$(docker ps -a --format '{{.Names}}')
    if [[ -n "$project_volumes" ]] || grep -Eq '^(interpreters|infra)_(postgres|redis|meili)_data$' <<< "$volumes" ||
       grep -Eq '^interpreters[-_]' <<< "$containers"; then
      die "Existing interpreter data or containers were found. Check them before initializing a fresh database."
    fi

    mkdir -p "$(dirname -- "$env_file")"
    temp_env=$(mktemp "${env_file}.XXXXXX")
    postgres_password=$(openssl rand -hex 32)
    jwt_secret=$(openssl rand -hex 48)
    meili_key=$(openssl rand -hex 32)
    {
      printf '%s\n' "$env_marker"
      sed -E '/^(IMAGE_API|IMAGE_WEB|IMAGE_NGINX|POSTGRES_PASSWORD|DATABASE_URL|JWT_SECRET|MEILI_MASTER_KEY|PUBLIC_BASE_URL|CORS_ORIGINS)=/d' .env.example
      printf 'IMAGE_API=interpreters-api:sha-%s\n' "$revision"
      printf 'IMAGE_WEB=interpreters-web:sha-%s\n' "$revision"
      printf 'IMAGE_NGINX=interpreters-nginx:sha-%s\n' "$revision"
      printf 'POSTGRES_PASSWORD=%s\n' "$postgres_password"
      printf 'DATABASE_URL=postgresql://postgres:%s@postgres:5432/interpreter_marketplace?schema=public\n' "$postgres_password"
      printf 'JWT_SECRET=%s\nMEILI_MASTER_KEY=%s\n' "$jwt_secret" "$meili_key"
      printf 'PUBLIC_BASE_URL=%s\nCORS_ORIGINS=%s\n' "$origin" "$origin"
    } > "$temp_env"
    ln -- "$temp_env" "$env_file"
  fi

  compose config --quiet
  for component in api web nginx; do
    case "$component" in
      nginx) dockerfile=infra/nginx.Dockerfile ;;
      *) dockerfile="apps/$component/Dockerfile" ;;
    esac
    image="interpreters-$component:sha-$revision"
    if ! docker image inspect "$image" >/dev/null 2>&1; then
      printf 'Building interpreter %s image\n' "$component"
      docker build --label "org.opencontainers.image.revision=$revision" -t "$image" -f "$dockerfile" .
    fi
  done

  compose up -d --pull missing --wait --wait-timeout 240
else
  grep -Fxq "PUBLIC_BASE_URL=$origin" "$env_file" ||
    die "The running interpreter deployment must be configured for $origin."
fi

docker exec "$gateway" wget -Y off -qO- http://interpreters-nginx:80/health | check_health ||
  die "Caddy could not reach a healthy interpreter service on the proxy network."
echo 'Caddy can reach the healthy interpreter service.'

capture_gateway
if [[ -e "$route_file" ]]; then
  cmp -s "$route_file" "$work_dir/site" || die "The interpreter site file changed during the deployment."
  check_gateway existing
else
  check_gateway free
  temp_site=$(mktemp "$sites_dir/.interpreters-site.XXXXXX")
  install -m 0644 -- "$work_dir/site" "$temp_site"
  ln -- "$temp_site" "$route_file"
  route_installed=true
  rm -- "$temp_site"
  temp_site=
  docker exec "$gateway" caddy adapt --config "$caddyfile" --adapter caddyfile > "$work_dir/candidate.json"
  if cmp -s "$work_dir/base.json" "$work_dir/candidate.json"; then
    caddyfile_source=$(docker inspect "$gateway" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}')
    [[ -f "$caddyfile_source" ]] || die "Caddy needs a mounted Caddyfile to add the interpreter site import."
    docker exec "$gateway" cat "$caddyfile" > "$work_dir/Caddyfile.original"
    {
      cat "$work_dir/Caddyfile.original"
      printf '\n\nimport /etc/caddy/sites/interpreters-temporary.caddy\n'
    } > "$work_dir/Caddyfile"
    docker exec -i -w /etc/caddy "$gateway" caddy adapt --config - --adapter caddyfile \
      < "$work_dir/Caddyfile" > "$work_dir/candidate.json"
  fi
  check_gateway candidate
  docker exec -i "$gateway" caddy validate --config - < "$work_dir/candidate.json"
  docker exec "$gateway" wget -Y off -qO- http://127.0.0.1:2019/config/ > "$work_dir/active.json"
  check_gateway candidate
  if [[ -n "$caddyfile_source" ]]; then
    cmp -s "$caddyfile_source" "$work_dir/Caddyfile.original" ||
      die "The mounted Caddyfile changed during deployment."
    caddyfile_backup=$(mktemp "${caddyfile_source}.interpreters-backup.XXXXXX")
    cat "$work_dir/Caddyfile.original" > "$caddyfile_backup"
    printf 'Saved the original Caddyfile to %s\n' "$caddyfile_backup"
    # Preserve the mounted inode so Caddy sees the change inside its container.
    caddyfile_changed=true
    cat "$work_dir/Caddyfile" > "$caddyfile_source"
    docker exec "$gateway" caddy adapt --config "$caddyfile" --adapter caddyfile > "$work_dir/persisted.json"
    cmp -s "$work_dir/candidate.json" "$work_dir/persisted.json" ||
      die "Caddy did not read the expected gateway configuration after saving the import."
  fi
  docker exec -i "$gateway" caddy reload --config - < "$work_dir/candidate.json"
  route_loaded=true
fi

printf 'Checking %s/health\n' "$origin"
curl -fsS --connect-timeout 5 --max-time 10 --retry 6 --retry-all-errors --retry-delay 3 "$origin/health" |
  check_health ||
  die "The containers are healthy and Caddy has loaded the route. The public HTTPS health check needs follow-up."
printf 'Interpreter Marketplace deployed at %s\n' "$origin"
if grep -Fxq 'SMTP_URL=' "$env_file"; then
  printf 'Set SMTP_URL and SMTP_FROM in %s to enable email verification.\n' "$env_file"
fi
