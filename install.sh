#!/usr/bin/env bash
# ============================================================
#  IT Stock - PM2 Installer for Ubuntu Server (IP 10.20.10.80)
#  ใช้สำหรับติดตั้งและรันด้วย PM2 (ไม่ใช้ Docker)
#
#  Backend ใช้ Lovable Cloud อยู่แล้ว
#  (ตามค่าใน .env: VITE_SUPABASE_URL)
#
#  Usage:  bash install.sh
# ============================================================
set -e

echo ">>> [1/5] อัปเดต apt + ติดตั้ง dependencies พื้นฐาน..."
sudo apt update -y
sudo apt install -y curl git ca-certificates ufw unzip

if ! command -v node >/dev/null 2>&1; then
  echo ">>> [2/5] ติดตั้ง Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
else
  echo ">>> [2/5] Node.js มีอยู่แล้ว ($(node -v)) — ข้าม"
fi

if ! command -v bun >/dev/null 2>&1; then
  echo ">>> [3/5] ติดตั้ง Bun..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  # เพิ่มเข้า .bashrc ถาวร
  grep -q 'BUN_INSTALL' ~/.bashrc || cat >> ~/.bashrc <<'EOF'

# Bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
EOF
else
  echo ">>> [3/5] Bun มีอยู่แล้ว — ข้าม"
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo ">>> [4/5] ติดตั้ง PM2 (process manager)..."
  sudo npm install -g pm2
else
  echo ">>> [4/5] PM2 มีอยู่แล้ว — ข้าม"
fi

if [ ! -f .env ]; then
  echo ">>> สร้างไฟล์ .env จาก .env.example"
  cp .env.example .env
  echo "    -> แก้ค่าใน .env ก่อน build (nano .env)"
fi

echo ">>> [5/5] เปิด firewall port 8080"
sudo ufw allow 8080/tcp || true

echo ""
echo "============================================================"
echo " ติดตั้งเครื่องมือเสร็จแล้ว! ขั้นตอนถัดไป:"
echo ""
echo "   1) แก้ไขไฟล์ .env (ถ้าจำเป็น):  nano .env"
echo ""
echo "   2) ติดตั้ง dependencies + build:"
echo "        bun install"
echo "        bun run build"
echo ""
echo "   3) Start ด้วย PM2:"
echo "        pm2 start ecosystem.config.cjs"
echo "        pm2 save"
echo "        pm2 startup       # copy คำสั่งที่ขึ้นมาแล้วรันด้วย sudo"
echo ""
echo "   4) เข้าใช้งานที่: http://10.20.10.80:8080"
echo ""
echo " หรือใช้สคริปต์ build+start แบบรวบ:  bash update.sh"
echo " ถ้ารันไม่ขึ้นให้ดู log:  pm2 logs it-stock --lines 200"
echo "============================================================"
