#!/usr/bin/env bash
# =============================================================================
# git-pull.sh — Pull latest code from GitHub only (no build, no deploy).
#
# Scope:  ONLY $BASE/repo/
# Never touches: PM2 · nginx · systemd · public/ · api-server/dist/
#
# Usage:
#   bash git-pull.sh           # pulls default branch (main)
#   bash git-pull.sh develop   # pulls a specific branch
# =============================================================================
set -euo pipefail

BASE="/home/automystics-solarepc/htdocs/solarepc.automystics.tech"
REPO_DIR="$BASE/repo"
REPO_URL="https://github.com/automystics-pvt-ltd/Mystics-SolarEPC"
BRANCH="${1:-main}"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "▶ No repo found. Cloning $REPO_URL (branch: $BRANCH)..."
  CLONE_URL="$REPO_URL"
  if [ -n "${GH_TOKEN:-}" ]; then
    CLONE_URL="https://${GH_TOKEN}@github.com/automystics-pvt-ltd/Mystics-SolarEPC"
  fi
  git clone --depth 1 --branch "$BRANCH" "$CLONE_URL" "$REPO_DIR"
else
  echo "▶ Pulling latest from origin/$BRANCH..."
  cd "$REPO_DIR"
  if [ -n "${GH_TOKEN:-}" ]; then
    git remote set-url origin \
      "https://${GH_TOKEN}@github.com/automystics-pvt-ltd/Mystics-SolarEPC"
  fi
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git reset --hard "origin/$BRANCH"
fi

echo ""
echo "✓ Repo at: $(git -C "$REPO_DIR" rev-parse --short HEAD)  branch: $BRANCH"
echo "  Run git-deploy.sh to build and deploy this code."
