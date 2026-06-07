# IT Stock Management System

ระบบจัดการสต็อกอุปกรณ์ IT — React 19 + TypeScript + Tailwind v4 + TanStack Start + Supabase

> **Deploy แบบ PM2 บน Ubuntu Server (IP `10.20.10.80`, port `8080`)**
> Backend ใช้ Supabase Cloud (ตามค่าใน `.env`)

---

## 📑 สารบัญ
1. [ติดตั้งครั้งแรก](#-1-ติดตั้งครั้งแรก)
2. [การตั้งค่า .env](#-2-การตั้งค่า-env)
3. [รัน / Restart / Stop ด้วย PM2](#-3-รัน--restart--stop-ด้วย-pm2)
4. [อัปเดตระบบ](#-4-อัปเดตระบบ)
5. [ถอนการติดตั้ง](#-5-ถอนการติดตั้ง)
6. [Troubleshooting](#-6-troubleshooting)

---

## 🚀 1. ติดตั้งครั้งแรก

### ข้อกำหนดเครื่อง
- Ubuntu 20.04 LTS ขึ้นไป
- RAM ≥ 2 GB, Disk ≥ 5 GB
- มีอินเทอร์เน็ตเพื่อโหลด Node.js / Bun / dependencies

### ขั้นตอน

```bash
# 1) Clone โปรเจกต์
git clone <YOUR_REPO_URL> it-stock
cd it-stock

# 2) ติดตั้ง Node.js 20 + Bun + PM2 + เปิด firewall
bash install.sh

# โหลด PATH ของ bun เข้า shell ปัจจุบัน
source ~/.bashrc

# 3) ติดตั้ง dependencies + build
bun install
bun run build

# 4) Start ด้วย PM2
pm2 start ecosystem.config.cjs
pm2 save

# 5) ตั้งให้รันอัตโนมัติเมื่อ boot
pm2 startup
# >>> copy คำสั่งที่ PM2 แนะนำขึ้นมา แล้วรันด้วย sudo <<<
```

เปิดเว็บที่ **http://10.20.10.80:8080**

> หรือใช้ทางลัด: หลังจาก `bash install.sh` แล้ว ให้รัน `bash update.sh`
> — ทำ `bun install → build → pm2 start/restart` ให้ในคำสั่งเดียว

---

## 🔧 2. การตั้งค่า `.env`

ไฟล์ `.env` ที่ใช้จริงมีตัวแปรของ Supabase Cloud อยู่แล้ว:

```env
VITE_SUPABASE_URL="https://<project>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon-key>"
VITE_SUPABASE_PROJECT_ID="<project-id>"
SUPABASE_URL="https://<project>.supabase.co"
SUPABASE_PUBLISHABLE_KEY="<anon-key>"
```

> ⚠️ ตัวแปร `VITE_*` ถูก **ฝังเข้า bundle ตอน build** ไม่ใช่อ่านตอน runtime
> เพราะฉะนั้นทุกครั้งที่แก้ `.env` ต้อง `bun run build` แล้ว `pm2 restart it-stock` ใหม่

ถ้าจะเปลี่ยน port หรือ IP ที่รัน: แก้ใน `ecosystem.config.cjs` (`--port 8080` / `--ip 0.0.0.0`)

---

## 🟢 3. รัน / Restart / Stop ด้วย PM2

```bash
pm2 start ecosystem.config.cjs   # เริ่ม
pm2 restart it-stock              # restart
pm2 stop it-stock                 # หยุด
pm2 delete it-stock               # ลบออกจาก PM2
pm2 logs it-stock                 # ดู log แบบ realtime
pm2 logs it-stock --lines 200     # ดู log 200 บรรทัดล่าสุด
pm2 status                        # ดูสถานะทั้งหมด
pm2 monit                         # หน้า monitor แบบ interactive
pm2 save                          # บันทึก state (กัน reboot แล้วหาย)
```

### ตั้งให้ start อัตโนมัติเมื่อ boot
```bash
pm2 startup
# คัดลอกคำสั่งที่ขึ้นมา (ขึ้นต้นด้วย sudo env ...) แล้วรัน
pm2 save
```

---

## 🔄 4. อัปเดตระบบ

```bash
bash update.sh
```

สคริปต์จะทำ: `git pull → bun install → bun run build → pm2 restart it-stock`

> ❗ ทุกครั้งที่แก้ `.env` หรือโค้ดต้อง **build ใหม่** เพราะตัวแปร `VITE_*` ถูก inline เข้า bundle

---

## 🗑️ 5. ถอนการติดตั้ง

```bash
bash uninstall.sh
```

จะถาม 2 ข้อ:
1. ลบ `node_modules` / `dist` ในโฟลเดอร์โปรเจกต์หรือไม่
2. ลบ PM2 ทั้งหมดออกจากระบบหรือไม่ (เลือก *No* ถ้ามี app อื่นใช้ PM2 อยู่)

---

## 🛠️ 6. Troubleshooting

**❌ เข้าเว็บไม่ได้จากเครื่องอื่นใน LAN**
```bash
sudo ufw status
sudo ufw allow 8080/tcp
ss -tlnp | grep 8080            # ตรวจว่า process listening จริง
pm2 logs it-stock --lines 100   # ดู error
```

**❌ PM2 บอก `Error: spawn ... workerd ENOENT`**
- `workerd` ต้องใช้ glibc — ปกติ Ubuntu มีอยู่แล้ว ไม่ใช่ปัญหา
- ถ้าใช้ Alpine/Distro แปลก ๆ ให้ติดตั้ง: `sudo apt install -y libc6`
- ลองรัน `npx wrangler --version` เพื่อดูว่า wrangler ติดตั้งสมบูรณ์

**❌ Build ล้มเหลว / out of memory**
```bash
NODE_OPTIONS="--max-old-space-size=4096" bun run build
```

**❌ Port 8080 ถูกใช้แล้ว**
- แก้ `ecosystem.config.cjs` เปลี่ยน `--port 8080` → port อื่น
- หรือหา process ที่ใช้อยู่: `sudo lsof -i :8080`

**❌ Login ไม่ผ่าน / `Invalid JWT` / CORS error**
- ตรวจค่า `VITE_SUPABASE_URL` และ `VITE_SUPABASE_PUBLISHABLE_KEY` ใน `.env`
- หลังแก้แล้วต้อง `bun run build && pm2 restart it-stock`

**❌ Reboot แล้ว PM2 ไม่ start เอง**
```bash
pm2 startup           # ทำคำสั่งที่แนะนำ
pm2 save              # บันทึก process list
```

**❌ อยากดู log แบบ rotate**
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 🧱 Tech Stack
- **Frontend**: React 19 + TypeScript + Tailwind v4 + TanStack Router/Start
- **Backend**: Supabase Cloud (PostgreSQL + Auth + Storage)
- **Runtime**: Cloudflare Worker (workerd) รันผ่าน `wrangler dev --local`
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
