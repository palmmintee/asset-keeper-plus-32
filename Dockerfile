# ---------- Build stage ----------
FROM oven/bun:1.2-alpine AS builder
WORKDIR /app

# Build-time env (จาก docker-compose: args)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile || bun install

COPY . .
RUN bun run build

# ---------- Runtime stage ----------
# แอปเป็น TanStack Start SSR (Cloudflare Worker) — รันด้วย wrangler
# ต้องใช้ glibc base (ไม่ใช่ alpine) เพราะ workerd binary ของ Cloudflare เป็น glibc-only
FROM node:20-slim AS runner
WORKDIR /app

# ติดตั้ง wrangler (workerd runtime) แบบ global
RUN npm install -g wrangler@4

# คัดลอกผลลัพธ์ build ทั้ง worker + static assets
COPY --from=builder /app/dist ./dist

EXPOSE 80
# รัน worker ที่ build แล้ว — config อยู่ใน dist/server/wrangler.json
WORKDIR /app/dist/server
CMD ["wrangler", "dev", "--ip", "0.0.0.0", "--port", "80", "--local", "--no-show-interactive-dev-session"]
