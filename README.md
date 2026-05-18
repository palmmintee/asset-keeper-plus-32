# IT Stock Management System

ระบบจัดการสต็อกอุปกรณ์ IT — React + TypeScript + Tailwind + Supabase (self-hosted)

> **ตัวอย่างนี้ตั้ง default ให้ใช้กับเครื่อง Ubuntu IP `10.20.10.80`**
> ถ้า IP ของคุณเป็นอย่างอื่น แก้ในไฟล์ `.env` ตัวเดียว แล้ว rebuild

---

## 📑 สารบัญ

1. [ติดตั้งครั้งแรก (Quick Start)](#-1-ติดตั้งครั้งแรก-quick-start)
2. [การตั้งค่า .env](#-2-การตั้งค่า-env)
3. [โครงสร้าง Dockerfile / docker-compose.yml](#-3-โครงสร้าง-dockerfile--docker-composeyml)
4. [การใช้งานหลังติดตั้ง](#-4-การใช้งานหลังติดตั้ง)
5. [การอัปเดตระบบ](#-5-การอัปเดตระบบ)
6. [การถอนการติดตั้ง](#-6-การถอนการติดตั้ง)
7. [Backup / Restore](#-7-backup--restore)
8. [Troubleshooting](#-8-troubleshooting)

---

## 🚀 1. ติดตั้งครั้งแรก (Quick Start)

### ข้อกำหนดเครื่อง Server
- Ubuntu 22.04 LTS ขึ้นไป
- RAM ≥ 4 GB, Disk ≥ 20 GB
- เปิดพอร์ต: `8080` (Web UI), `8000` (Supabase API), `3001` (Supabase Studio)
- IP ใน LAN: `10.20.10.80` (ตัวอย่าง)

### วิธีติดตั้งแบบสั้น 3 บรรทัด

```bash
git clone <YOUR_REPO_URL> it-stock
cd it-stock
sudo bash install.sh
```

สคริปต์ `install.sh` จะทำให้อัตโนมัติ:
- ติดตั้ง Docker + Docker Compose
- สร้าง `.env` จาก `.env.example` (ค่า default ใช้กับ IP 10.20.10.80)
- เปิด firewall ให้พอร์ต 8080 / 8000 / 3001

หลังจากนั้น:

```bash
nano .env                      # แก้รหัสผ่านและ JWT_SECRET (ดูข้อ 2)
docker compose up -d --build   # เริ่มระบบ (ครั้งแรกใช้เวลา ~2-5 นาที)
docker compose ps              # ตรวจสถานะ
```

เปิดเว็บที่ **http://10.20.10.80:8080** — ผู้ใช้คนแรกที่สมัครจะได้สิทธิ์ **Admin** อัตโนมัติ

---

## 🔧 2. การตั้งค่า `.env`

| ตัวแปร | ค่าที่ต้องตั้ง | คำอธิบาย |
|---|---|---|
| `PUBLIC_URL` | `http://10.20.10.80:8000` | URL ของ Supabase API ที่ browser เครื่อง client เข้าถึงได้ (ต้องเป็น IP จริง ไม่ใช่ localhost) |
| `POSTGRES_PASSWORD` | (สุ่มใหม่) | รหัสผ่าน PostgreSQL — **ห้ามใช้ค่า default** |
| `JWT_SECRET` | (สุ่มใหม่ ≥ 32 ตัว) | secret สำหรับสร้าง JWT token |
| `ANON_KEY` | (สร้างจาก JWT_SECRET) | public key สำหรับ frontend |
| `SERVICE_ROLE_KEY` | (สร้างจาก JWT_SECRET) | admin key (ห้ามเผยแพร่) |

### สุ่มค่าใหม่อย่างปลอดภัย

```bash
# 1) สุ่ม POSTGRES_PASSWORD
openssl rand -base64 24

# 2) สุ่ม JWT_SECRET
openssl rand -base64 48
```

### สร้าง ANON_KEY / SERVICE_ROLE_KEY ให้ตรงกับ JWT_SECRET

ไปที่ https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
→ วาง `JWT_SECRET` ที่ได้ → จะได้ `ANON_KEY` และ `SERVICE_ROLE_KEY` → นำมาใส่ใน `.env`

> ⚠️ ทุกครั้งที่เปลี่ยน `JWT_SECRET` ต้อง regenerate `ANON_KEY` และ `SERVICE_ROLE_KEY` ใหม่ทั้งคู่ ไม่งั้น login ไม่ผ่าน

### เปลี่ยน IP Server

ถ้าย้ายไปเครื่องอื่นที่ IP ไม่ใช่ `10.20.10.80`:

```bash
nano .env                      # แก้ PUBLIC_URL=http://<NEW_IP>:8000
docker compose up -d --build app   # rebuild เฉพาะ frontend
```

---

## 🐳 3. โครงสร้าง Dockerfile / docker-compose.yml

### Dockerfile (ของ Frontend)
- **Build stage**: ใช้ `oven/bun:1.1-alpine` คอมไพล์ React → static files
- **Runtime stage**: ใช้ `nginx:alpine` เสิร์ฟไฟล์ที่ port 80
- รับค่า build args: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`

### docker-compose.yml มี 8 services
| Service | Port | หน้าที่ |
|---|---|---|
| `db` | 5432 | PostgreSQL 15 + auto-run migrations จาก `supabase/migrations/` |
| `auth` | – | GoTrue (จัดการ JWT auth, auto-confirm email เปิดอยู่) |
| `rest` | – | PostgREST (REST API อัตโนมัติจาก schema) |
| `storage` | – | Supabase Storage (เก็บรูป asset) |
| `meta` | – | pg-meta (ใช้คู่กับ Studio) |
| `kong` | 8000 | API Gateway รวม endpoint `/auth/v1`, `/rest/v1`, `/storage/v1` |
| `studio` | 3001 | Web UI จัดการ Database |
| `app` | 8080 | Frontend (Nginx + React build) |

> Migrations ใน `supabase/migrations/*.sql` จะถูกรันอัตโนมัติ **ครั้งแรก** ที่ container `db` start (mount เข้า `/docker-entrypoint-initdb.d/`)

---

## 🌐 4. การใช้งานหลังติดตั้ง

| บริการ | URL |
|---|---|
| **ระบบ IT Stock (Frontend)** | http://10.20.10.80:8080 |
| **Supabase Studio** (จัดการ DB ผ่านเว็บ) | http://10.20.10.80:3001 |
| Supabase API (Kong) | http://10.20.10.80:8000 |

### คำสั่งที่ใช้บ่อย

```bash
docker compose ps                  # ดูสถานะ container
docker compose logs -f app         # ดู log ของ frontend
docker compose logs -f db          # ดู log ของ database
docker compose restart app         # restart เฉพาะ frontend
docker compose stop                # หยุดทั้งหมด
docker compose start               # เริ่มอีกครั้ง
```

---

## 🔄 5. การอัปเดตระบบ

วิธีเร็ว — ใช้สคริปต์:

```bash
bash update.sh
```

หรือทำเอง:

```bash
git pull
docker compose pull
docker compose up -d --build
```

> ข้อมูลใน Database จะ**ไม่หาย** เพราะเก็บใน Docker volume (`db-data`)

---

## 🗑️ 6. การถอนการติดตั้ง

```bash
bash uninstall.sh
```

สคริปต์จะถามว่าจะลบข้อมูลด้วยหรือไม่:
- **ไม่ลบข้อมูล** → `docker compose down` (เก็บ volume ไว้ — ติดตั้งใหม่ครั้งหน้า ข้อมูลกลับมา)
- **ลบข้อมูลทั้งหมด** → `docker compose down -v` (ลบ volume `db-data`, `storage-data` ถาวร)

ถ้าต้องการลบ Docker images ของโปรเจกต์ด้วย:
```bash
docker image prune -a
```

---

## 💾 7. Backup / Restore

### Backup ฐานข้อมูล (ทำสม่ำเสมอ!)
```bash
docker compose exec db pg_dump -U postgres postgres > backup_$(date +%F).sql
```

### Restore
```bash
cat backup_2026-05-18.sql | docker compose exec -T db psql -U postgres postgres
```

### Backup ไฟล์ใน Storage (รูป asset)
```bash
docker run --rm -v it-stock_storage-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/storage_$(date +%F).tar.gz -C /data .
```

### ตั้ง cron backup อัตโนมัติทุกวันตอนตี 2
```bash
crontab -e
# เพิ่มบรรทัด:
0 2 * * * cd /home/$USER/it-stock && docker compose exec -T db pg_dump -U postgres postgres > /home/$USER/backups/db_$(date +\%F).sql
```

---

## 🛠️ 8. Troubleshooting

**❌ เข้าเว็บไม่ได้จากเครื่องอื่นใน LAN**
```bash
sudo ufw status                    # ตรวจ firewall
sudo ufw allow 8080/tcp
sudo ufw allow 8000/tcp
ip addr show                       # ตรวจว่า IP ตรงกับ PUBLIC_URL
```

**❌ Login ไม่ผ่าน / "Invalid JWT"**
→ `ANON_KEY` ไม่ตรงกับ `JWT_SECRET` — generate ใหม่ตามข้อ 2 แล้ว:
```bash
docker compose up -d --build app auth
```

**❌ Frontend โหลด แต่เรียก API error / CORS**
→ `PUBLIC_URL` ใน `.env` ต้องเป็น IP ที่ client เข้าถึงได้ (ไม่ใช่ `localhost`/`127.0.0.1`) แล้ว:
```bash
docker compose up -d --build app
```

**❌ Database ไม่ start / migrations error**
```bash
docker compose logs db | tail -100
```
ถ้าต้องการ reset database ทั้งหมด (⚠️ ข้อมูลหาย):
```bash
docker compose down -v
docker compose up -d --build
```

**❌ Port ชนกับโปรแกรมอื่น**
แก้ port mapping ในไฟล์ `docker-compose.yml` เช่นเปลี่ยน `"8080:80"` → `"9090:80"`

---

## 🧱 Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind v4 + TanStack Router/Start
- **Backend**: Supabase self-hosted (PostgREST + GoTrue + Storage + Kong)
- **Database**: PostgreSQL 15
- **Auth**: JWT + Row-Level Security + RBAC (admin/user/auditor)

## 📋 Features

- ✅ Login + RBAC (Admin/User/Auditor) — ผู้สมัครคนแรก = Admin
- ✅ Dashboard สรุป + Widget สินเปลืองใกล้หมด
- ✅ จัดการ Asset (CRUD + Search/Filter/Pagination + QR Code + แสดงอายุการใช้งาน)
- ✅ อุปกรณ์สิ้นเปลือง (Consumables)
- ✅ จำหน่ายอุปกรณ์ (Disposal Management + Print/Export CSV)
- ✅ Master Data (Categories / Locations / Statuses)
- ✅ Audit Log
- ✅ Dark Mode + ภาษาไทย
