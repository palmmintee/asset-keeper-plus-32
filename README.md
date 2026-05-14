# IT Stock Management System

ระบบจัดการสต็อกอุปกรณ์ IT — React + TypeScript + Tailwind + Supabase (self-hosted)

## 🚀 ติดตั้งบน Ubuntu Server (LAN) ด้วย Docker Compose

ระบบนี้ self-host **ครบทั้ง Frontend + Database + Auth + Storage** ในเครื่อง Ubuntu เดียว ใช้งานในวง LAN ได้ทันที (ไม่ต้องพึ่ง cloud)

### 1. ข้อกำหนดเครื่อง Server

- Ubuntu 22.04 LTS ขึ้นไป (RAM ≥ 4GB, Disk ≥ 20GB)
- เปิด port: `8080` (Frontend), `8000` (Supabase API), `3001` (Studio - DB UI), `5432` (Postgres)

### 2. ติดตั้ง Docker

```bash
# Update
sudo apt update && sudo apt upgrade -y

# Install Docker + Compose
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# ตรวจ
docker --version
docker compose version
```

### 3. Clone โปรเจกต์

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
```

### 4. ตั้งค่า Environment

```bash
cp .env.example .env
nano .env
```

แก้ค่าสำคัญ:

| ตัวแปร | คำอธิบาย |
|---|---|
| `PUBLIC_URL` | URL ที่ผู้ใช้ใน LAN จะเข้าถึง Supabase API เช่น `http://192.168.1.100:8000` (ใช้ IP จริงของ Ubuntu Server) |
| `POSTGRES_PASSWORD` | รหัสผ่านฐานข้อมูล — **ต้องเปลี่ยน** |
| `JWT_SECRET` | secret สำหรับสร้าง JWT — **ต้องเปลี่ยน** (≥ 32 ตัว) |
| `ANON_KEY` / `SERVICE_ROLE_KEY` | JWT keys ที่ลงนามด้วย `JWT_SECRET` (ต้อง regenerate หลังเปลี่ยน secret) |

#### 🔑 สร้าง JWT Keys ใหม่

```bash
# สุ่ม JWT_SECRET
openssl rand -base64 48

# สร้าง ANON_KEY และ SERVICE_ROLE_KEY ผ่านเว็บนี้:
# https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
# กรอก JWT_SECRET → จะได้ ANON_KEY และ SERVICE_ROLE_KEY → ใส่ใน .env
```

หา IP เครื่อง: `ip addr show` หรือ `hostname -I`

### 5. Start

```bash
docker compose up -d --build
```

รอ ~1-2 นาที (ครั้งแรกจะ download images)

ตรวจสถานะ: `docker compose ps`  
ดู log: `docker compose logs -f app`

### 6. เข้าใช้งาน

| บริการ | URL |
|---|---|
| **Frontend (ระบบ IT Stock)** | `http://<server-ip>:8080` |
| **Supabase Studio** (จัดการ DB) | `http://<server-ip>:3001` |
| Supabase API | `http://<server-ip>:8000` |

> 👤 **ผู้ใช้คนแรกที่สมัคร** จะได้สิทธิ์ **Admin** อัตโนมัติ

### 7. คำสั่งที่ใช้บ่อย

```bash
docker compose stop              # หยุด
docker compose start             # เริ่มใหม่
docker compose restart app       # restart เฉพาะ frontend
docker compose down              # หยุด + ลบ container (ข้อมูลใน volume ยังอยู่)
docker compose down -v           # ⚠️ ลบข้อมูลทั้งหมด
docker compose logs -f <service> # ดู log
docker compose pull && docker compose up -d --build  # update
```

### 8. Backup ฐานข้อมูล

```bash
# Backup
docker compose exec db pg_dump -U postgres postgres > backup_$(date +%F).sql

# Restore
cat backup_2026-05-14.sql | docker compose exec -T db psql -U postgres postgres
```

---

## 🛠️ Troubleshooting

**เข้าหน้าเว็บไม่ได้จากเครื่องอื่นใน LAN**
```bash
sudo ufw allow 8080/tcp
sudo ufw allow 8000/tcp
sudo ufw allow 3001/tcp
```

**Login ไม่ผ่าน → "Invalid JWT"**  
→ `ANON_KEY` ไม่ตรงกับ `JWT_SECRET` — สร้างใหม่ตามขั้นตอนข้อ 4

**Frontend โหลดแต่เรียก API ไม่ได้**  
→ `PUBLIC_URL` ต้องเป็น IP ที่เครื่อง client เข้าถึงได้ (ไม่ใช่ `localhost`/`127.0.0.1`) แล้ว rebuild: `docker compose up -d --build app`

---

## 🧱 Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS + TanStack Router/Start
- **Backend**: Supabase self-hosted (PostgREST + GoTrue + Storage)
- **Database**: PostgreSQL 15
- **Auth**: JWT + Row-Level Security + Role-Based Access Control (admin/user/auditor)

## 📋 Features (v1 Core)

- ✅ Login/Logout + RBAC (Admin/User/Auditor)
- ✅ Dashboard พร้อมกราฟสรุป
- ✅ จัดการ Asset (CRUD + Search/Filter/Pagination)
- ✅ QR Code per asset
- ✅ Export Excel
- ✅ Master Data (Categories / Locations / Statuses)
- ✅ Audit Log
- ✅ Dark Mode + รองรับภาษาไทย
