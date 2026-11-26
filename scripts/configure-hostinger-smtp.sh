#!/usr/bin/env bash
set -euo pipefail
umask 077

die() {
  printf 'SMTP setup stopped. %s\n' "$*" >&2
  exit 1
}

sender=${1:-}
[[ $sender =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die 'Pass the Hostinger mailbox address.'
[[ -t 0 ]] || die 'Run this from the interactive VPS Web console.'

env_file=/etc/interpreters/interpreters.env
exec 9>/run/lock/interpreters-deploy.lock
flock -n 9 || die 'Another interpreter deployment is running.'

checkout=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' interpreters-api-1)
[[ $checkout == /* && -d $checkout ]] || die 'The running API has no valid Compose working directory.'
if [[ ! -f "$checkout/infra/docker-compose.yml" && -f "$checkout/docker-compose.yml" && -f "$checkout/docker-compose.vps.yml" ]]; then
  checkout=$(dirname -- "$checkout")
fi
cd -- "$checkout"
[[ -f infra/docker-compose.yml && -f infra/docker-compose.vps.yml && -f .env.example ]] ||
  die 'The interpreter Compose files could not be located.'
[[ -r $env_file ]] || die 'The interpreter environment file could not be read.'
origin=$(sed -n 's/^PUBLIC_BASE_URL=//p' "$env_file")
[[ $origin =~ ^https://[a-zA-Z0-9.-]+$ ]] || die 'The app environment needs a valid HTTPS address.'

IFS= read -rs -p "Hostinger mailbox password for $sender: " smtp_password
printf '\n'
[[ -n $smtp_password ]] || die 'The mailbox password is empty.'
smtp_url=$(printf '%s' "$smtp_password" | python3 -c '
import sys
from urllib.parse import quote

user = quote(sys.argv[1], safe="")
password = quote(sys.stdin.read(), safe="")
print(f"smtps://{user}:{password}@smtp.hostinger.com:465")
' "$sender")
unset smtp_password

# Test authentication over TLS from the running API container without sending a message.
printf 'Checking Hostinger SMTP authentication\n'
printf '%s' "$smtp_url" | docker exec -i interpreters-api-1 node -e '
  const url = new URL(require("node:fs").readFileSync(0, "utf8"));
  const transport = require("nodemailer").createTransport({
    host: url.hostname,
    port: Number(url.port),
    secure: true,
    auth: { user: decodeURIComponent(url.username), pass: decodeURIComponent(url.password) },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000
  });
  transport.verify().then(() => {
    console.log("SMTP authentication succeeded.");
  }).catch((error) => {
    console.error("SMTP authentication check failed (%s).", error.code ?? "unknown");
    process.exitCode = 1;
  }).finally(() => transport.close());
' || die 'The running app still has its previous email settings.'

previous=$(mktemp "$env_file.before-smtp.XXXXXX")
cp -- "$env_file" "$previous"
candidate=$(mktemp "$env_file.smtp.XXXXXX")
trap 'rm -f -- "$candidate"' EXIT
{
  sed -E '/^SMTP_(URL|FROM)=/d' "$previous"
  printf 'SMTP_URL=%s\nSMTP_FROM=%s\n' "$smtp_url" "$sender"
} > "$candidate"
unset smtp_url

mapfile -t compose_env_keys < <(sed -nE 's/^([A-Z][A-Z0-9_]+)=.*/\1/p' .env.example)
compose() (
  unset "${compose_env_keys[@]}"
  docker compose -p interpreters --env-file "$1" -f infra/docker-compose.yml -f infra/docker-compose.vps.yml "${@:2}"
)

switch_api() {
  compose "$1" up -d --no-deps --no-build --pull never --wait --wait-timeout 120 api &&
    compose "$1" exec -T nginx nginx -s reload
}

compose "$candidate" config --quiet
cmp -s "$env_file" "$previous" || die 'The interpreter environment changed during preparation.'
if ! switch_api "$candidate" ||
   ! docker exec interpreters-api-1 sh -c '[ -n "$SMTP_URL" ] && [ "$SMTP_FROM" = "$1" ]' sh "$sender" ||
   ! curl -fsS --retry 5 --retry-delay 2 --retry-all-errors --connect-timeout 4 --max-time 8 "$origin/health" | grep -Fxq '{"status":"ok"}'; then
  echo 'The new settings could not be verified. Restoring the previous API settings.' >&2
  switch_api "$previous" || die 'The previous API settings need attention.'
  exit 1
fi

mv -T -- "$candidate" "$env_file"
printf 'Signup email configured for %s\n' "$sender"
