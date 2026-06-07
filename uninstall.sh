#!/usr/bin/env bash
# ============================================================
#  IT Stock - Uninstall (PM2)
# ============================================================
set -e

echo ">>> หยุดและลบ process จาก PM2..."
pm2 delete it-stock 2>/dev/null || true
pm2 save --force

read -rp "ลบโฟลเดอร์ node_modules และ dist ด้วยหรือไม่? [y/N]: " ans
if [[ "$ans" =~ ^[Yy]$ ]]; then
  rm -rf node_modules dist .vite
  echo "   ลบเรียบร้อย"
fi

read -rp "ลบ PM2 ทั้งหมดออกจากระบบหรือไม่? (กระทบ app อื่นที่ใช้ PM2 ด้วย) [y/N]: " ans2
if [[ "$ans2" =~ ^[Yy]$ ]]; then
  sudo npm uninstall -g pm2
  echo "   ลบ PM2 แล้ว"
fi

echo ">>> ถอนติดตั้งเสร็จสิ้น"
