#!/usr/bin/env bash
# ============================================================
#  IT Stock - One-shot installer for Ubuntu Server
#  Usage:  sudo bash install.sh
# ============================================================
set -e

echo ">>> [1/4] อัปเดต apt..."
sudo apt update -y && sudo apt upgrade -y
sudo apt install -y curl git ca-certificates ufw

if ! command -v docker >/dev/null 2>&1; then
  echo ">>> [2/4] ติดตั้ง Docker..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
else
  echo ">>> [2/4] Docker มีอยู่แล้ว — ข้าม"
fi

if [ ! -f .env ]; then
  echo ">>> [3/4] สร้างไฟล์ .env จาก .env.example"
  cp .env.example .env
  echo "    -> แก้ค่าใน .env (PUBLIC_URL, POSTGRES_PASSWORD, JWT_SECRET) ก่อนรันจริง"
else
  echo ">>> [3/4] พบ .env อยู่แล้ว — ข้าม"
fi

echo ">>> [4/4] เปิด firewall ports 8080 / 8000 / 3001"
sudo ufw allow 8080/tcp || true
sudo ufw allow 8000/tcp || true
sudo ufw allow 3001/tcp || true

echo ""
echo "============================================================"
echo " ติดตั้งเสร็จ! ขั้นตอนถัดไป:"
echo "   1) แก้ไขไฟล์ .env  (nano .env)"
echo "   2) เริ่มระบบ:        docker compose up -d --build"
echo "   3) เข้าใช้งาน:       http://10.20.10.80:8080"
echo "============================================================"
