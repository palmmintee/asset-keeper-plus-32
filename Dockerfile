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
FROM nginx:alpine AS runner
COPY --from=builder /app/dist/client /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
