#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Full automatic deployment for solarepc.automystics.tech
#
# ONE command does everything:
#   git pull → install deps → build → backup → deploy files → restart app
#
# Usage:
#   bash deploy.sh              # deploy latest main branch
#   bash deploy.sh develop      # deploy a specific branch
#
# Scope:  ONLY /home/automystics-solarepc/htdocs/solarepc.automystics.tech/
# =============================================================================
set -euo pipefail

# ── CONFIGURE THESE ───────────────────────────────────────────────────────────
BASE="/home/automystics-solarepc/htdocs/solarepc.automystics.tech"
REPO_URL="https://github.com/automystics-pvt-ltd/Mystics-SolarEPC"
BRANCH="${1:-main}"
PM2_APP_NAME="solarepc-api"          # your PM2 process name (pm2 list to check)
API_PORT=5000
# ─────────────────────────────────────────────────────────────────────────────

REPO_DIR="$BASE/repo"
PUBLIC_OUT="$BASE/public"
API_DIR="$BASE/api-server"
API_DIST="$API_DIR/dist"
BACKUP_DIR="$BASE/backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$BASE/deploy-$TIMESTAMP.log"

# ── Colours ───────────────────────────────────────────────────────────────────
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

step() { echo -e "\n${CYAN}${BOLD}[$((STEP++))/$TOTAL] $*${NC}"; }
ok()   { echo -e "    ${GREEN}✓${NC} $*"; }
info() { echo -e "    ${YELLOW}→${NC} $*"; }
fail() { echo -e "\n${RED}✗ FAILED: $*${NC}" >&2; exit 1; }

STEP=1
TOTAL=9

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Auto Deploy — solarepc.automystics.tech${NC}"
echo -e "${BOLD}  Branch: $BRANCH   $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"

# ── [1] Preflight ─────────────────────────────────────────────────────────────
step "Checking required tools"
command -v git  >/dev/null 2>&1 || fail "git is not installed"
command -v node >/dev/null 2>&1 || fail "node is not installed"
command -v npm  >/dev/null 2>&1 || fail "npm is not installed"

if ! command -v pnpm >/dev/null 2>&1; then
  info "pnpm not found — installing..."
  npm install -g pnpm --silent
fi
ok "node $(node -v)  |  pnpm $(pnpm -v)"

mkdir -p "$BASE" "$BACKUP_DIR" "$PUBLIC_OUT" "$API_DIR"

# ── [2] Git pull ──────────────────────────────────────────────────────────────
step "Git pull from $REPO_URL ($BRANCH)"

if [ ! -d "$REPO_DIR/.git" ]; then
  info "First run — cloning repository..."
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$REPO_DIR"
  ok "Cloned"
else
  cd "$REPO_DIR"
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git reset --hard "origin/$BRANCH"
  cd "$BASE"
  ok "Pulled"
fi

COMMIT=$(git -C "$REPO_DIR" rev-parse --short HEAD)
ok "Commit: $COMMIT"

# ── [3] Install dependencies ──────────────────────────────────────────────────
step "Installing dependencies (pnpm install)"
cd "$REPO_DIR"
pnpm install --no-frozen-lockfile 2>&1 | tail -3
ok "Dependencies installed"

# ── [4] Build API server ──────────────────────────────────────────────────────
step "Building API server"
pnpm --filter @workspace/api-server run build 2>&1 | tail -3
ok "API server built → artifacts/api-server/dist/"

# ── [5] Build ERP frontend ────────────────────────────────────────────────────
step "Building ERP frontend"
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/erp run build 2>&1 | tail -3
ok "ERP frontend built → artifacts/erp/dist/public/"

# ── [6] Backup current live files ─────────────────────────────────────────────
step "Backing up current live files"
[ -d "$PUBLIC_OUT"  ] && cp -a "$PUBLIC_OUT"  "$BACKUP_DIR/public_$TIMESTAMP"
[ -d "$API_DIST"    ] && cp -a "$API_DIST"    "$BACKUP_DIR/api-dist_$TIMESTAMP"
# Keep only last 3 backups
ls -dt "$BACKUP_DIR"/public_*   2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
ls -dt "$BACKUP_DIR"/api-dist_* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
ok "Backup saved ($TIMESTAMP)"

# ── [7] Deploy built output ───────────────────────────────────────────────────
step "Deploying files"
rsync -a --delete "$REPO_DIR/artifacts/erp/dist/public/"  "$PUBLIC_OUT/"
ok "public/ updated"

mkdir -p "$API_DIST"
rsync -a --delete "$REPO_DIR/artifacts/api-server/dist/"  "$API_DIST/"
cp "$REPO_DIR/artifacts/api-server/package.json"          "$API_DIR/package.json"
ok "api-server/dist/ updated"

# ── [8] Install production Node deps (pg) ────────────────────────────────────
step "Installing production Node deps"
cd "$API_DIR"
npm install --production --silent
ok "node_modules ready (pg installed)"
cd "$BASE"

# ── [9] .env check + PM2 restart ─────────────────────────────────────────────
step "Verifying .env and restarting app"

if [ ! -f "$API_DIR/.env" ]; then
  cat > "$API_DIR/.env" <<ENVTEMPLATE
NODE_ENV=production
PORT=$API_PORT
DATABASE_URL=postgresql://solarepc:solarepc@localhost:5432/solarepc
SESSION_SECRET=CHANGE_ME_replace_with_a_long_random_string
ENVTEMPLATE
  echo ""
  echo -e "  ${RED}⚠  .env was missing — template created at:${NC}"
  echo    "     $API_DIR/.env"
  echo -e "  ${RED}   Edit it now and set DATABASE_URL + SESSION_SECRET${NC}"
  echo    "     Then rerun: bash deploy.sh"
  exit 1
fi
ok ".env found"

if command -v pm2 >/dev/null 2>&1; then
  if pm2 list | grep -q "$PM2_APP_NAME"; then
    pm2 reload "$PM2_APP_NAME" --update-env
    ok "PM2 process '$PM2_APP_NAME' reloaded (zero-downtime)"
  else
    # Start fresh — only this app, nothing else
    pm2 start "$API_DIST/index.mjs" \
      --name "$PM2_APP_NAME" \
      --interpreter node \
      --interpreter-args "--enable-source-maps" \
      --cwd "$API_DIR" \
      --env-file "$API_DIR/.env"
    pm2 save
    ok "PM2 process '$PM2_APP_NAME' started and saved"
  fi
else
  info "PM2 not found — start manually:"
  info "  cd $API_DIR && PORT=$API_PORT node --enable-source-maps dist/index.mjs"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  ✓  Deploy complete — commit $COMMIT${NC}"
echo -e "${BOLD}${GREEN}  ✓  $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "  Site:  https://solarepc.automystics.tech"
echo "  API:   http://localhost:$API_PORT/api/healthz"
echo ""
