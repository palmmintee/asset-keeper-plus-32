#!/usr/bin/env bash
# ============================================================
#  IT Stock - Update & Restart (PM2)
#  ดึงโค้ดล่าสุด → build → restart PM2
# ============================================================
set -e

echo ">>> [1/4] git pull ดึงโค้ดล่าสุด..."
git pull

echo ">>> [2/4] bun install..."
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
if ! command -v bun >/dev/null 2>&1; then
  echo "ไม่พบ bun ใน PATH — ให้รัน: source ~/.bashrc หรือ bash install.sh"
  exit 1
fi
bun install

echo ">>> [3/4] bun run build..."
bun run build

echo ">>> [4/4] Restart PM2..."
if pm2 describe it-stock >/dev/null 2>&1; then
  pm2 delete it-stock
fi
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo ">>> อัปเดตเสร็จ! ดู log: pm2 logs it-stock"
echo ">>> เปิดเว็บ:        http://10.20.10.80:8080"
