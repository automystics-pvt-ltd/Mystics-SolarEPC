# Deployment Guide — solarepc.automystics.tech

## What's in this package

| Path | Description |
|------|-------------|
| `public/` | ERP frontend static files (served directly by Nginx) |
| `api-server/dist/` | Bundled Node.js API server |
| `api-server/package.json` | Production dependencies (only `pg`) |
| `api-server/env.production` | Environment variables — **rename to `.env` on the server** |
| `ecosystem.config.cjs` | PM2 process config |
| `nginx-solarepc.conf` | Nginx virtual-host config |
| `server-setup.sh` | One-time server setup (run as root) |
| `deploy.sh` | Incremental deploy script (run from your local machine) |

---

## First-time server setup

### 1. Upload the package

From your local machine (where you downloaded this folder):

```bash
scp -r solarepc-deploy.tar.gz automystics-solarepc@solarepc.automystics.tech:~
ssh automystics-solarepc@solarepc.automystics.tech
tar -xzf solarepc-deploy.tar.gz
cd solarepc-deploy
```

### 2. Configure environment variables

```bash
cp api-server/env.production \
   /home/automystics-solarepc/htdocs/solarepc.automystics.tech/api-server/.env
```

**⚠️ Edit `.env` and verify:**
- `DATABASE_URL` — if PostgreSQL runs on the same server, `localhost` is correct.  
  If it's a separate host, replace `localhost` with that host's IP or hostname.
- `SESSION_SECRET` — a strong random value is already set; you may replace it.

### 3. Copy files into place

```bash
DEPLOY_DIR="/home/automystics-solarepc/htdocs/solarepc.automystics.tech"

mkdir -p "$DEPLOY_DIR/public" "$DEPLOY_DIR/api-server" "$DEPLOY_DIR/logs"

cp -r public/*              "$DEPLOY_DIR/public/"
cp -r api-server/dist       "$DEPLOY_DIR/api-server/"
cp    api-server/package.json "$DEPLOY_DIR/api-server/"
cp    ecosystem.config.cjs  "$DEPLOY_DIR/"
```

### 4. Install production Node dependencies

```bash
cd /home/automystics-solarepc/htdocs/solarepc.automystics.tech/api-server
npm install --production
```

### 5. Configure Nginx (run as root / sudo)

```bash
sudo cp nginx-solarepc.conf /etc/nginx/sites-available/solarepc.automystics.tech
sudo ln -sf /etc/nginx/sites-available/solarepc.automystics.tech \
            /etc/nginx/sites-enabled/solarepc.automystics.tech
sudo nginx -t && sudo systemctl reload nginx
```

### 6. Start the API with PM2

```bash
cd /home/automystics-solarepc/htdocs/solarepc.automystics.tech
pm2 start ecosystem.config.cjs
pm2 save

# Make PM2 start on reboot (run the command it prints):
pm2 startup
```

### 7. (Recommended) Enable HTTPS with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx \
  -d solarepc.automystics.tech \
  -d www.solarepc.automystics.tech
```

---

## Verify it's working

```bash
# API health check
curl http://localhost:5000/api/healthz

# Check PM2 status
pm2 status

# Tail API logs
pm2 logs solarepc-api --lines 50
```

---

## Subsequent deployments (after the first setup)

Use `deploy.sh` from your **local machine**:

```bash
chmod +x deploy.sh
./deploy.sh
```

It will prompt for your SSH password, rsync the new files, install dependencies, and do a zero-downtime PM2 reload.

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| 502 Bad Gateway | API not running — `pm2 status` and `pm2 logs solarepc-api` |
| Blank page / 404 on refresh | Nginx SPA fallback missing — verify `try_files $uri /index.html` in the nginx config |
| DB connection error | `DATABASE_URL` in `.env` — confirm host, port, user, password, dbname |
| `PORT` error in logs | `.env` not found or `PORT=5000` missing |
