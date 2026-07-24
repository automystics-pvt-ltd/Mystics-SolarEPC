#!/usr/bin/env bash
# =============================================================================
# server-setup.sh  —  Run this ONCE on the Ubuntu server as root (or with sudo)
# to configure Nginx and PM2 for solarepc.automystics.tech
# =============================================================================
set -euo pipefail

DEPLOY_DIR="/home/automystics-solarepc/htdocs/solarepc.automystics.tech"
NGINX_CONF="/etc/nginx/sites-available/solarepc.automystics.tech"
NGINX_LINK="/etc/nginx/sites-enabled/solarepc.automystics.tech"

echo "==> Creating directory structure..."
mkdir -p "$DEPLOY_DIR/public"
mkdir -p "$DEPLOY_DIR/api-server/dist"
mkdir -p "$DEPLOY_DIR/logs"
chown -R automystics-solarepc:automystics-solarepc "$DEPLOY_DIR"

echo "==> Installing Nginx if not present..."
if ! command -v nginx &>/dev/null; then
    apt-get update -y && apt-get install -y nginx
fi

echo "==> Installing Nginx site config..."
cp "$(dirname "$0")/nginx-solarepc.conf" "$NGINX_CONF"
ln -sf "$NGINX_CONF" "$NGINX_LINK"

# Remove default site if it exists
rm -f /etc/nginx/sites-enabled/default

echo "==> Testing Nginx config..."
nginx -t

echo "==> Reloading Nginx..."
systemctl reload nginx || service nginx reload

echo "==> Installing production Node dependencies for API server..."
cd "$DEPLOY_DIR/api-server"
npm install --production

echo "==> Setting up PM2 to start on boot..."
# Run as the app user
sudo -u automystics-solarepc bash -c "
  cd $DEPLOY_DIR
  pm2 start ecosystem.config.cjs
  pm2 save
"

# Configure PM2 startup (run the output command it prints)
env PATH=\$PATH:/usr/bin pm2 startup systemd -u automystics-solarepc --hp /home/automystics-solarepc

echo ""
echo "==> Setup complete!"
echo "    API running at http://127.0.0.1:5000/api/healthz"
echo "    Site available at http://solarepc.automystics.tech"
echo ""
echo "    NEXT: Obtain an SSL cert:"
echo "    certbot --nginx -d solarepc.automystics.tech -d www.solarepc.automystics.tech"
