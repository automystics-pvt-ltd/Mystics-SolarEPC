#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Run this ON THE SERVER inside the deployment directory.
#
# Scope:  ONLY /home/automystics-solarepc/htdocs/solarepc.automystics.tech/
# Never touches: PM2, nginx, systemd, or any path outside the above.
#
# Usage (on server):
#   cd /home/automystics-solarepc/htdocs/solarepc.automystics.tech
#   bash deploy/server/deploy.sh
# =============================================================================
set -euo pipefail

BASE="/home/automystics-solarepc/htdocs/solarepc.automystics.tech"
BACKUP="$BASE/backup"
PUBLIC="$BASE/public"
API="$BASE/api-server"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "==> [1/4] Creating backup of current live files ($TIMESTAMP)..."
mkdir -p "$BACKUP"

if [ -d "$PUBLIC" ]; then
  cp -a "$PUBLIC" "$BACKUP/public_$TIMESTAMP"
fi
if [ -d "$API/dist" ]; then
  cp -a "$API/dist" "$BACKUP/api-dist_$TIMESTAMP"
fi
# Keep only the last 3 backups to avoid filling disk
ls -dt "$BACKUP"/public_* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
ls -dt "$BACKUP"/api-dist_* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true

echo "==> [2/4] Verifying .env exists..."
if [ ! -f "$API/.env" ]; then
  if [ -f "$API/env.production" ]; then
    cp "$API/env.production" "$API/.env"
    echo "    Copied env.production → .env"
  else
    echo "ERROR: $API/.env is missing."
    echo "       Create it with at minimum:"
    echo "         NODE_ENV=production"
    echo "         PORT=5000"
    echo "         DATABASE_URL=postgresql://..."
    echo "         SESSION_SECRET=..."
    exit 1
  fi
fi

echo "==> [3/4] Installing production Node dependencies (pg only)..."
cd "$API"
npm install --production --silent
cd "$BASE"

echo "==> [4/4] Setting file ownership..."
chown -R root:root "$PUBLIC" 2>/dev/null || true
chown -R root:root "$API"    2>/dev/null || true

echo ""
echo "✓ Files are in place."
echo ""
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │  PM2 is NOT touched. Restart your process manually: │"
echo "  │                                                     │"
echo "  │  pm2 restart <your-app-name>                        │"
echo "  │  — or —                                             │"
echo "  │  pm2 reload  <your-app-name>  (zero-downtime)       │"
echo "  └─────────────────────────────────────────────────────┘"
echo ""
echo "  To start fresh (if not already in PM2):"
echo "  cd $BASE && node --enable-source-maps api-server/dist/index.mjs"
