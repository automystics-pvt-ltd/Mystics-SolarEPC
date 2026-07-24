#!/usr/bin/env bash
# =============================================================================
# git-deploy.sh — Pull from GitHub, build, and deploy to this directory ONLY.
#
# Scope:  ONLY /home/automystics-solarepc/htdocs/solarepc.automystics.tech/
# Never touches: PM2 · nginx · systemd · any path outside the above
#
# First run:  bash git-deploy.sh
# Subsequent: bash git-deploy.sh          (pulls latest & rebuilds)
# Specific tag/branch: bash git-deploy.sh main
# =============================================================================
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
BASE="/home/automystics-solarepc/htdocs/solarepc.automystics.tech"
REPO_DIR="$BASE/repo"
REPO_URL="https://github.com/automystics-pvt-ltd/Mystics-SolarEPC"
BRANCH="${1:-main}"

PUBLIC_OUT="$BASE/public"
API_DIST="$BASE/api-server/dist"
API_ENV="$BASE/api-server/.env"
BACKUP="$BASE/backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
info() { echo -e "${YELLOW}▶${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*" >&2; exit 1; }

# ── Preflight checks ─────────────────────────────────────────────────────────
info "Checking required tools..."
command -v node  >/dev/null 2>&1 || err "node is not installed"
command -v npm   >/dev/null 2>&1 || err "npm is not installed"
command -v git   >/dev/null 2>&1 || err "git is not installed"

# Install pnpm if missing
if ! command -v pnpm >/dev/null 2>&1; then
  info "pnpm not found — installing via npm..."
  npm install -g pnpm --silent
fi
ok "Tools ready  (node $(node -v), pnpm $(pnpm -v))"

# ── Step 1: Clone or pull ─────────────────────────────────────────────────────
if [ ! -d "$REPO_DIR/.git" ]; then
  info "Cloning $REPO_URL (branch: $BRANCH)..."
  # If repo is private, git will prompt for credentials.
  # To avoid prompts, set: export GH_TOKEN=your_token  before running this script,
  # and the URL will be injected automatically below.
  CLONE_URL="$REPO_URL"
  if [ -n "${GH_TOKEN:-}" ]; then
    CLONE_URL="https://${GH_TOKEN}@github.com/automystics-pvt-ltd/Mystics-SolarEPC"
  fi
  git clone --depth 1 --branch "$BRANCH" "$CLONE_URL" "$REPO_DIR"
else
  info "Updating existing repo (branch: $BRANCH)..."
  cd "$REPO_DIR"
  if [ -n "${GH_TOKEN:-}" ]; then
    git remote set-url origin \
      "https://${GH_TOKEN}@github.com/automystics-pvt-ltd/Mystics-SolarEPC"
  fi
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git reset --hard "origin/$BRANCH"
  cd "$BASE"
fi
ok "Code at: $REPO_DIR ($(git -C "$REPO_DIR" rev-parse --short HEAD))"

# ── Step 2: Install dependencies ──────────────────────────────────────────────
info "Installing dependencies..."
cd "$REPO_DIR"
pnpm install --frozen-lockfile 2>&1 | tail -5
ok "Dependencies installed"

# ── Step 3: Build API server ──────────────────────────────────────────────────
info "Building API server..."
pnpm --filter @workspace/api-server run build 2>&1 | tail -5
ok "API server built → artifacts/api-server/dist/"

# ── Step 4: Build ERP frontend ────────────────────────────────────────────────
info "Building ERP frontend (BASE_PATH=/)..."
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/erp run build 2>&1 | tail -5
ok "ERP frontend built → artifacts/erp/dist/public/"

# ── Step 5: Backup current live files ────────────────────────────────────────
info "Backing up current live files ($TIMESTAMP)..."
mkdir -p "$BACKUP"
[ -d "$PUBLIC_OUT" ] && cp -a "$PUBLIC_OUT" "$BACKUP/public_$TIMESTAMP"
[ -d "$API_DIST"   ] && cp -a "$API_DIST"   "$BACKUP/api-dist_$TIMESTAMP"
# Keep only the last 3 backups
ls -dt "$BACKUP"/public_*   2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
ls -dt "$BACKUP"/api-dist_* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
ok "Backup saved"

# ── Step 6: Deploy built output ───────────────────────────────────────────────
info "Deploying ERP frontend to public/..."
mkdir -p "$PUBLIC_OUT"
rsync -a --delete "$REPO_DIR/artifacts/erp/dist/public/" "$PUBLIC_OUT/"
ok "public/ updated"

info "Deploying API server to api-server/dist/..."
mkdir -p "$API_DIST"
rsync -a --delete "$REPO_DIR/artifacts/api-server/dist/" "$API_DIST/"
ok "api-server/dist/ updated"

# Deploy minimal production package.json for externals (pg)
cp "$REPO_DIR/artifacts/api-server/package.json" "$BASE/api-server/package.json"

# ── Step 7: Install production deps (pg) ─────────────────────────────────────
info "Installing production Node deps (pg)..."
cd "$BASE/api-server"
npm install --production --silent
ok "node_modules ready"
cd "$BASE"

# ── Step 8: Verify .env ───────────────────────────────────────────────────────
if [ ! -f "$API_ENV" ]; then
  cat > "$API_ENV" <<'ENVTEMPLATE'
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://solarepc:solarepc@localhost:5432/solarepc
SESSION_SECRET=CHANGE_ME_generate_a_long_random_string_here
ENVTEMPLATE
  echo ""
  echo -e "${RED}⚠ WARNING: .env was missing — a template has been created at:${NC}"
  echo "    $API_ENV"
  echo "  Edit it now and set DATABASE_URL and SESSION_SECRET before starting the app."
  echo ""
else
  ok ".env exists"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo " ✓  Deploy complete — commit: $(git -C "$REPO_DIR" rev-parse --short HEAD)"
echo "════════════════════════════════════════════════════════"
echo ""
echo "  Files live at:"
echo "    $PUBLIC_OUT"
echo "    $API_DIST"
echo ""
echo "  ┌────────────────────────────────────────────────────┐"
echo "  │  PM2 is NOT touched. Restart your process yourself:│"
echo "  │                                                    │"
echo "  │  pm2 restart <your-app-name>                       │"
echo "  │  — or, if starting for the first time:             │"
echo "  │  PORT=5000 node --enable-source-maps \\             │"
echo "  │    $API_DIST/index.mjs                             │"
echo "  └────────────────────────────────────────────────────┘"
echo ""
