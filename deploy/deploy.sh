#!/usr/bin/env bash
# =============================================================================
# deploy.sh  —  Run this from YOUR LOCAL MACHINE (not Replit) to push a
# new build to the production server.
#
# Prerequisites on your local machine:
#   - sshpass   (brew install sshpass  /  apt install sshpass)
#   - rsync
#   - ssh
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
# =============================================================================
set -euo pipefail

SSH_USER="automystics-solarepc"
SSH_HOST="solarepc.automystics.tech"
SSH_PORT="${SSH_PORT:-22}"
REMOTE_DIR="/home/automystics-solarepc/htdocs/solarepc.automystics.tech"

# Prompt for password (not stored anywhere)
read -rsp "SSH password for ${SSH_USER}@${SSH_HOST}: " SSH_PASS
echo ""
export SSHPASS="$SSH_PASS"

RSYNC_SSH="sshpass -e ssh -p $SSH_PORT -o StrictHostKeyChecking=accept-new"

echo "==> Uploading ERP frontend (static files)..."
rsync -az --delete \
  -e "$RSYNC_SSH" \
  public/ \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/public/"

echo "==> Uploading API server dist..."
rsync -az --delete \
  -e "$RSYNC_SSH" \
  api-server/dist/ \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/api-server/dist/"

echo "==> Uploading API server package.json..."
rsync -az \
  -e "$RSYNC_SSH" \
  api-server/package.json \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/api-server/package.json"

echo "==> Uploading PM2 config..."
rsync -az \
  -e "$RSYNC_SSH" \
  ecosystem.config.cjs \
  "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/ecosystem.config.cjs"

echo "==> Installing production dependencies and restarting API..."
sshpass -e ssh -p "$SSH_PORT" -o StrictHostKeyChecking=accept-new \
  "${SSH_USER}@${SSH_HOST}" bash -s <<'REMOTE'
set -euo pipefail
DEPLOY_DIR="/home/automystics-solarepc/htdocs/solarepc.automystics.tech"
cd "$DEPLOY_DIR/api-server"
npm install --production --silent
cd "$DEPLOY_DIR"
if pm2 list | grep -q "solarepc-api"; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save
echo "API restarted."
REMOTE

unset SSHPASS
echo ""
echo "==> Deployment complete!"
echo "    https://solarepc.automystics.tech"
