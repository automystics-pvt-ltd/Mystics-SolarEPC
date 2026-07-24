#!/usr/bin/env bash
# =============================================================================
# status.sh — Show the state of the deployment directory.
# Read-only. Touches nothing.
# =============================================================================
BASE="/home/automystics-solarepc/htdocs/solarepc.automystics.tech"

echo "════════════════════════════════════════════════"
echo " Deployment Status — solarepc.automystics.tech"
echo "════════════════════════════════════════════════"
echo ""

echo "── public/ (ERP frontend) ───────────────────"
if [ -d "$BASE/public" ]; then
  echo "  ✓ exists  $(du -sh "$BASE/public" | cut -f1)"
  echo "  index.html: $(stat -c '%y' "$BASE/public/index.html" 2>/dev/null | cut -d. -f1 || echo 'missing')"
else
  echo "  ✗ MISSING"
fi
echo ""

echo "── api-server/dist/ (Node.js API) ──────────"
if [ -f "$BASE/api-server/dist/index.mjs" ]; then
  echo "  ✓ exists  $(du -sh "$BASE/api-server/dist" | cut -f1)"
  echo "  index.mjs: $(stat -c '%y' "$BASE/api-server/dist/index.mjs" | cut -d. -f1)"
else
  echo "  ✗ MISSING"
fi
echo ""

echo "── .env ─────────────────────────────────────"
if [ -f "$BASE/api-server/.env" ]; then
  echo "  ✓ exists"
  grep -E "^(NODE_ENV|PORT|DATABASE_URL)=" "$BASE/api-server/.env" \
    | sed 's/DATABASE_URL=.*/DATABASE_URL=***hidden***/g'
else
  echo "  ✗ MISSING — create $BASE/api-server/.env"
fi
echo ""

echo "── Backups ──────────────────────────────────"
ls -dt "$BASE/backup"/* 2>/dev/null | head -6 | while read -r f; do
  echo "  $(basename "$f")  ($(du -sh "$f" | cut -f1))"
done || echo "  none"
echo ""

echo "── API connectivity ─────────────────────────"
if curl -sf http://localhost:5000/api/healthz >/dev/null 2>&1; then
  echo "  ✓ API responding on port 5000"
else
  echo "  ✗ API not responding on port 5000"
fi
echo ""
