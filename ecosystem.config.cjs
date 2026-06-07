// PM2 config สำหรับรัน IT Stock Frontend (TanStack Start / Cloudflare Worker build)
// ใช้ wrangler รัน worker ที่ build แล้วใน dist/server/
//
// คำสั่งที่ใช้บ่อย:
//   pm2 start ecosystem.config.cjs
//   pm2 restart it-stock
//   pm2 stop it-stock
//   pm2 logs it-stock
//   pm2 save && pm2 startup     # ให้ start อัตโนมัติเมื่อ boot

module.exports = {
  apps: [
    {
      name: "it-stock",
      cwd: "./dist/server",
      script: "npx",
      args: [
        "wrangler",
        "dev",
        "--ip", "0.0.0.0",
        "--port", "8080",
        "--local",
        "--no-show-interactive-dev-session",
      ],
      interpreter: "none",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "1G",
      autorestart: true,
      watch: false,
    },
  ],
};
