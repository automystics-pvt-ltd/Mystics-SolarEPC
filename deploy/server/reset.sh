#!/usr/bin/env bash
# =============================================================================
# reset.sh — Roll back to the previous backup.
#
# Scope:  ONLY /home/automystics-solarepc/htdocs/solarepc.automystics.tech/
# Never touches: PM2, nginx, systemd, or any path outside the above.
#
# Usage (on server):
#   cd /home/automystics-solarepc/htdocs/solarepc.automystics.tech
#   bash deploy/server/reset.sh
# =============================================================================
set -euo pipefail

BASE="/home/automystics-solarepc/htdocs/solarepc.automystics.tech"
BACKUP="$BASE/backup"

# Find most recent backup pair
LAST_PUBLIC=$(ls -dt "$BACKUP"/public_* 2>/dev/null | head -1)
LAST_API=$(ls -dt "$BACKUP"/api-dist_* 2>/dev/null | head -1)

if [ -z "$LAST_PUBLIC" ] && [ -z "$LAST_API" ]; then
  echo "ERROR: No backups found in $BACKUP"
  exit 1
fi

echo "Available backups:"
ls -dt "$BACKUP"/public_* "$BACKUP"/api-dist_* 2>/dev/null | head -10

echo ""
echo "Restoring most recent backup:"
echo "  public/  ← $LAST_PUBLIC"
echo "  api dist ← $LAST_API"
echo ""
read -rp "Confirm restore? [y/N] " CONFIRM
[[ "$CONFIRM" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

if [ -n "$LAST_PUBLIC" ]; then
  rm -rf "$BASE/public"
  cp -a "$LAST_PUBLIC" "$BASE/public"
  echo "✓ public/ restored"
fi

if [ -n "$LAST_API" ]; then
  rm -rf "$BASE/api-server/dist"
  cp -a "$LAST_API" "$BASE/api-server/dist"
  echo "✓ api-server/dist/ restored"
fi

echo ""
echo "✓ Rollback complete."
echo ""
echo "  Restart your PM2 process manually to apply:"
echo "  pm2 restart <your-app-name>"
