# IT Stock Management System

ระบบจัดการสต็อกอุปกรณ์ IT — React 19 + TypeScript + Tailwind v4 + TanStack Start

> Deploy แบบ PM2 บน Ubuntu Server: **http://10.20.10.80:8080**
> Backend ใช้ Lovable Cloud ตามค่าใน `.env`

---

## 🚀 ติดตั้งครั้งแรก

```bash
git clone <YOUR_REPO_URL> it-stock
cd it-stock

bash install.sh
source ~/.bashrc

bash update.sh
```

จากนั้นเปิดเว็บที่ **http://10.20.10.80:8080**

---

## 🔧 การตั้งค่า `.env`

ไฟล์ `.env` ต้องมีค่าหลักเหล่านี้:

```env
VITE_SUPABASE_URL="https://<backend-url>"
VITE_SUPABASE_PUBLISHABLE_KEY="<publishable-key>"
VITE_SUPABASE_PROJECT_ID="<project-id>"
SUPABASE_URL="https://<backend-url>"
SUPABASE_PUBLISHABLE_KEY="<publishable-key>"
```

ทุกครั้งที่แก้ `.env` ต้องรัน:

```bash
bash update.sh
```

---

## 🟢 คำสั่ง PM2 ที่ใช้บ่อย

```bash
pm2 start ecosystem.config.cjs
pm2 restart it-stock --update-env
pm2 stop it-stock
pm2 delete it-stock
pm2 logs it-stock --lines 200
pm2 status
pm2 save
```

ตั้งให้รันเองหลัง reboot:

```bash
pm2 startup
pm2 save
```

ให้ copy คำสั่ง `sudo env ...` ที่ PM2 แสดงขึ้นมา แล้วรัน 1 ครั้ง

---

## 🔄 อัปเดตระบบ

```bash
bash update.sh
```

สคริปต์จะทำ `git pull → bun install → bun run build → restart PM2`

---

## 🛠️ Troubleshooting

**เข้าเว็บไม่ได้**

```bash
pm2 status
pm2 logs it-stock --lines 200
ss -tlnp | grep 8080
sudo ufw allow 8080/tcp
```

**Port 8080 ถูกใช้แล้ว**

```bash
sudo lsof -i :8080
```

หยุด process ที่ชน port หรือแก้ port ใน `ecosystem.config.cjs`

**Build ล้มเหลวเพราะ RAM ไม่พอ**

```bash
NODE_OPTIONS="--max-old-space-size=4096" bun run build
pm2 restart it-stock --update-env
```

**รันแล้วยังเป็น config เก่า**

```bash
pm2 delete it-stock
bash update.sh
pm2 logs it-stock --lines 200
```

**ตรวจแบบละเอียดบนเครื่อง Ubuntu**

```bash
node -v
bun -v
pm2 -v
ls -la dist
cat ecosystem.config.cjs
pm2 describe it-stock
pm2 logs it-stock --lines 200
```

---

## 🧱 Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind v4 + TanStack Router/Start
- **Backend**: Lovable Cloud
- **Runtime**: Vite Preview หลัง build
- **Process Manager**: PM2

## 📋 Features
- ✅ Login + RBAC (Admin/User/Auditor)
- ✅ Dashboard + Widget สินเปลืองใกล้หมด
- ✅ จัดการ Asset (CRUD + Search/Filter + QR Code)
- ✅ อุปกรณ์สิ้นเปลือง (Consumables)
- ✅ จำหน่ายอุปกรณ์ (Disposal Management + Export CSV)
- ✅ Master Data (Categories / Locations / Statuses)
- ✅ Audit Log
- ✅ Dark Mode + ภาษาไทย
