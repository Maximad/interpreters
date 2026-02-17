#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR=${PROJECT_DIR:-/opt/interpreters}
DEPLOY_USER=${DEPLOY_USER:-$(whoami)}

( crontab -l 2>/dev/null || true; \
  echo "0 3 * * * PROJECT_DIR=$PROJECT_DIR $PROJECT_DIR/scripts/backup.sh >> /var/log/interpreters-backup.log 2>&1" ) \
  | crontab -

echo "Backup cron installed for $DEPLOY_USER"
