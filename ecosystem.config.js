// PM2 Ecosystem File — Production Configuration
// Chạy: pm2 start ecosystem.config.js --env production

module.exports = {
  apps: [
    {
      name: "backend-project",
      script: "src/server.js",

      // ✅ Cluster mode — tận dụng tất cả CPU cores
      // Server 4 cores → 4 Node.js processes chạy song song
      instances: "max",
      exec_mode: "cluster",

      // ✅ Tự restart khi crash
      autorestart: true,
      watch: false,

      // ✅ Restart nếu dùng quá 500MB RAM
      max_memory_restart: "500M",

      // ✅ Environment variables
      env: {
        NODE_ENV: "development",
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
      },

      // ✅ Log files
      error_file: "logs/pm2-error.log",
      out_file:   "logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",

      // ✅ Graceful shutdown — đợi requests hiện tại xử lý xong
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};