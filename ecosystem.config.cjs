// PM2 config สำหรับรัน IT Stock Frontend หลังจาก `bun run build`
// ใช้ Vite Preview จาก root โปรเจกต์ เพื่อให้เจอ build output และไฟล์ config ครบ
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
      cwd: __dirname,
      script: "node_modules/vite/bin/vite.js",
      args: [
        "preview",
        "--host",
        "0.0.0.0",
        "--port",
        "8080",
      ],
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "1G",
      autorestart: true,
      watch: false,
    },
  ],
};
