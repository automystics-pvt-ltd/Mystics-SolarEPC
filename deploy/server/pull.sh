#!/usr/bin/env bash
# =============================================================================
# pull.sh — Pull the latest build package from a URL and deploy it.
#
# Use this when you have a CDN/object-storage URL for a new build tarball,
# or when you share the tarball via scp/wget/curl and want a one-command update.
#
# Scope:  ONLY /home/automystics-solarepc/htdocs/solarepc.automystics.tech/
# Never touches: PM2, nginx, systemd, or any path outside the above.
#
# Usage (on server):
#   bash pull.sh https://your-cdn.example.com/solarepc-deploy.tar.gz
#   — or —
#   bash pull.sh /tmp/solarepc-deploy.tar.gz        # local file also works
# =============================================================================
set -euo pipefail

BASE="/home/automystics-solarepc/htdocs/solarepc.automystics.tech"
WORK="/tmp/solarepc-pull-$$"
SOURCE="${1:-}"

if [ -z "$SOURCE" ]; then
  echo "Usage: $0 <url-or-local-path-to-tarball>"
  echo ""
  echo "Example:"
  echo "  $0 https://storage.example.com/builds/solarepc-deploy.tar.gz"
  echo "  $0 /tmp/solarepc-deploy.tar.gz"
  exit 1
fi

mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT

# ── Download or copy ──────────────────────────────────────────────────────────
if [[ "$SOURCE" =~ ^https?:// ]]; then
  echo "▶ Downloading $SOURCE..."
  curl -fsSL "$SOURCE" -o "$WORK/package.tar.gz"
else
  echo "▶ Using local file $SOURCE..."
  cp "$SOURCE" "$WORK/package.tar.gz"
fi

echo "▶ Extracting..."
tar -xzf "$WORK/package.tar.gz" -C "$WORK"

# Detect the extracted directory (could be "deploy" or similar)
EXTRACTED=$(find "$WORK" -mindepth 1 -maxdepth 1 -type d | head -1)
if [ -z "$EXTRACTED" ]; then
  echo "ERROR: Nothing extracted from tarball."
  exit 1
fi

echo "▶ Running deploy from extracted package..."
cp "$EXTRACTED/server/deploy.sh" "$WORK/deploy.sh" 2>/dev/null || \
  cp "$EXTRACTED/deploy/server/deploy.sh" "$WORK/deploy.sh" 2>/dev/null || true

# Sync files
if [ -d "$EXTRACTED/public" ]; then
  rsync -a --delete "$EXTRACTED/public/" "$BASE/public/"
  echo "✓ public/ updated"
fi
if [ -d "$EXTRACTED/api-server/dist" ]; then
  rsync -a --delete "$EXTRACTED/api-server/dist/" "$BASE/api-server/dist/"
  echo "✓ api-server/dist/ updated"
fi
if [ -f "$EXTRACTED/api-server/package.json" ]; then
  cp "$EXTRACTED/api-server/package.json" "$BASE/api-server/package.json"
fi

echo "▶ Installing production dependencies..."
cd "$BASE/api-server" && npm install --production --silent && cd "$BASE"

echo ""
echo "✓ Pull & deploy complete."
echo ""
echo "  Restart your PM2 process manually to apply:"
echo "  pm2 restart <your-app-name>"
