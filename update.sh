#!/usr/bin/env bash
# อัปเดตระบบจาก git แล้ว rebuild
set -e
echo ">>> Pull latest code..."
git pull
echo ">>> Rebuild & restart containers..."
docker compose pull
docker compose up -d --build
echo ">>> เสร็จ. ตรวจสถานะด้วย:  docker compose ps"
