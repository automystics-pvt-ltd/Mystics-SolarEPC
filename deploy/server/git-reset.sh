#!/usr/bin/env bash
# =============================================================================
# git-reset.sh — Roll back live files to a previous backup OR to a git commit.
#
# Scope:  ONLY /home/automystics-solarepc/htdocs/solarepc.automystics.tech/
# Never touches: PM2 · nginx · systemd · any path outside the above
#
# Usage:
#   bash git-reset.sh                  # restore most recent backup (no prompt)
#   bash git-reset.sh abc1234          # rebuild & deploy a specific git commit
# =============================================================================
set -euo pipefail

BASE="/home/automystics-solarepc/htdocs/solarepc.automystics.tech"
BACKUP="$BASE/backup"
REPO_DIR="$BASE/repo"
TARGET="${1:-}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
info() { echo -e "${YELLOW}▶${NC} $*"; }

# ── Mode A: restore from backup (no argument) ─────────────────────────────────
if [ -z "$TARGET" ]; then
  echo "Available backups:"
  ls -dt "$BACKUP"/public_* "$BACKUP"/api-dist_* 2>/dev/null \
    | head -10 | while read -r f; do echo "  $(basename "$f")"; done \
    || { echo "  No backups found."; exit 1; }

  LAST_PUBLIC=$(ls -dt "$BACKUP"/public_*   2>/dev/null | head -1)
  LAST_API=$(   ls -dt "$BACKUP"/api-dist_* 2>/dev/null | head -1)

  echo ""
  echo "Will restore:"
  [ -n "$LAST_PUBLIC" ] && echo "  public/          ← $(basename "$LAST_PUBLIC")"
  [ -n "$LAST_API"    ] && echo "  api-server/dist/ ← $(basename "$LAST_API")"
  echo ""
  read -rp "Confirm? [y/N] " CONFIRM
  [[ "$CONFIRM" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

  if [ -n "$LAST_PUBLIC" ]; then
    rm -rf "$BASE/public"
    cp -a "$LAST_PUBLIC" "$BASE/public"
    ok "public/ restored from $(basename "$LAST_PUBLIC")"
  fi
  if [ -n "$LAST_API" ]; then
    rm -rf "$BASE/api-server/dist"
    cp -a "$LAST_API" "$BASE/api-server/dist"
    ok "api-server/dist/ restored from $(basename "$LAST_API")"
  fi

# ── Mode B: reset repo to a specific commit and rebuild ───────────────────────
else
  [ -d "$REPO_DIR/.git" ] || { echo "ERROR: repo not cloned yet. Run git-pull.sh first."; exit 1; }

  info "Checking out commit $TARGET in repo..."
  cd "$REPO_DIR"
  git fetch --all
  git checkout "$TARGET"
  ACTUAL=$(git rev-parse --short HEAD)
  ok "Repo at $ACTUAL"

  info "Rebuilding from commit $ACTUAL..."
  pnpm install --frozen-lockfile 2>&1 | tail -3
  pnpm --filter @workspace/api-server run build 2>&1 | tail -3
  PORT=3000 BASE_PATH=/ pnpm --filter @workspace/erp run build 2>&1 | tail -3
  ok "Build complete"

  info "Deploying..."
  rsync -a --delete "$REPO_DIR/artifacts/erp/dist/public/"  "$BASE/public/"
  rsync -a --delete "$REPO_DIR/artifacts/api-server/dist/"  "$BASE/api-server/dist/"
  ok "Files deployed (commit $ACTUAL)"
fi

echo ""
echo "  ┌────────────────────────────────────────────────────┐"
echo "  │  PM2 is NOT touched. Restart your process yourself:│"
echo "  │  pm2 restart <your-app-name>                       │"
echo "  └────────────────────────────────────────────────────┘"
echo ""
