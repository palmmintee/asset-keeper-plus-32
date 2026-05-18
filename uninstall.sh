#!/usr/bin/env bash
# ถอนการติดตั้งระบบ (มี option ลบข้อมูล)
set -e

read -p "⚠️  ลบ container ทั้งหมด? (y/N): " ans
[[ "$ans" != "y" && "$ans" != "Y" ]] && exit 0

read -p "⚠️  ลบข้อมูลฐานข้อมูลและไฟล์ใน Storage ด้วยหรือไม่? (พิมพ์ DELETE เพื่อยืนยัน): " confirm
if [ "$confirm" = "DELETE" ]; then
  echo ">>> หยุดและลบทุก container + volumes"
  docker compose down -v
else
  echo ">>> หยุดและลบ container เท่านั้น (ข้อมูลใน volume ยังอยู่)"
  docker compose down
fi

echo ">>> เสร็จ"
