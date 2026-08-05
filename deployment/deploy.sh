#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — Mystics ERP VPS deployment script
#
# What this script does:
#   1. Installs/updates all npm dependencies
#   2. Builds the API server (TypeScript → ESM bundle)
#   3. Builds the frontend (Vite static output)
#   4. Restarts the API server via PM2 (zero-downtime reload)
#
# Prerequisites on the VPS:
#   - Node.js ≥ 20 (recommend 22 LTS)
#   - pnpm  ≥ 9   (npm i -g pnpm)
#   - PM2         (npm i -g pm2)
#   - PostgreSQL running + DATABASE_URL set in /opt/mystics/.env.production
#   - /opt/mystics/.env.production exists and is filled in (see .env.production.example)
#
# Usage (run from the repo root on the VPS):
#   chmod +x deployment/deploy.sh
#   ./deployment/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-/opt/mystics/.env.production}"
LOG_DIR="/var/log/mystics"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║           Mystics ERP — VPS Deployment               ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Sanity checks ──────────────────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo "✗  $ENV_FILE not found."
  echo "   Copy deployment/.env.production.example to $ENV_FILE and fill in all values."
  exit 1
fi

command -v node  >/dev/null || { echo "✗  node not found. Install Node.js ≥ 20."; exit 1; }
command -v pnpm  >/dev/null || { echo "✗  pnpm not found. Run: npm i -g pnpm"; exit 1; }
command -v pm2   >/dev/null || { echo "✗  pm2  not found. Run: npm i -g pm2";  exit 1; }

NODE_VER=$(node -e "process.stdout.write(process.versions.node)")
echo "→  Node ${NODE_VER}  |  pnpm $(pnpm --version)  |  pm2 $(pm2 --version)"

# ── Load env for the build steps ───────────────────────────────────────────────
set -o allexport
# shellcheck disable=SC1090
source "$ENV_FILE"
set +o allexport

# ── Create log directory ────────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"

cd "$REPO_ROOT"
echo ""
echo "── 1/4  Installing dependencies ──────────────────────────────────────────"
pnpm install --frozen-lockfile

echo ""
echo "── 2/4  Building API server ──────────────────────────────────────────────"
pnpm --filter @workspace/api-server run build

echo ""
echo "── 3/4  Building frontend ────────────────────────────────────────────────"
# BASE_PATH and NODE_ENV are sourced from the env file above
export NODE_ENV=production
pnpm --filter @workspace/erp run build

echo ""
echo "── 4/4  Restarting API server via PM2 ────────────────────────────────────"
# Create local upload directory if needed
LOCAL_UPLOAD_DIR="${LOCAL_UPLOAD_DIR:-/opt/mystics/data/uploads}"
mkdir -p "$LOCAL_UPLOAD_DIR"

if pm2 describe mystics-api >/dev/null 2>&1; then
  echo "   PM2 process exists — reloading (zero-downtime)…"
  pm2 reload ecosystem.config.cjs --only mystics-api
else
  echo "   Starting PM2 process for the first time…"
  pm2 start deployment/ecosystem.config.cjs
  pm2 save
fi

echo ""
echo "── Health check ─────────────────────────────────────────────────────────"
sleep 3
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT:-8080}/api/auth/me" || echo "000")
if [[ "$HTTP_STATUS" == "401" || "$HTTP_STATUS" == "200" ]]; then
  echo "   ✓  API server responded HTTP $HTTP_STATUS (healthy)"
else
  echo "   ✗  API server returned HTTP $HTTP_STATUS — check PM2 logs:"
  echo "      pm2 logs mystics-api --lines 50"
  exit 1
fi

echo ""
echo "✓  Deployment complete."
echo ""
echo "   Frontend:  served as static files from artifacts/erp/dist/public"
echo "              (configure Nginx root to that path)"
echo "   API:       http://127.0.0.1:${PORT:-8080}  (proxied via Nginx /api/)"
echo "   Uploads:   ${LOCAL_UPLOAD_DIR}"
echo "   PM2 logs:  pm2 logs mystics-api"
echo ""
