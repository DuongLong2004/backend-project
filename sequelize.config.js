require("dotenv").config();

/*
 * ════════════════════════════════════════════════════════════════════════════
 * SEQUELIZE CLI CONFIG (cho migrations)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * File này KHÁC với src/config/db.js — file đó cho runtime app,
 * còn file này cho `npx sequelize-cli db:migrate`.
 *
 * Hỗ trợ 2 mode tương tự:
 *   - development: DB_HOST/DB_USER/DB_PASSWORD/DB_NAME (local MySQL)
 *   - production : DATABASE_URL hoặc MYSQL_URL (Railway connection string)
 *
 * Cách chạy migration:
 *   - Local:   npx sequelize-cli db:migrate
 *   - Railway: npx sequelize-cli db:migrate --env production
 *
 * Khi chạy --env production, Sequelize CLI chỉ đọc env nó CÓ trong .env file.
 * Nên muốn migrate Railway từ máy local → tạm thêm DATABASE_URL vào .env
 * (hoặc set inline biến env trước lệnh — xem README hướng dẫn).
 * ════════════════════════════════════════════════════════════════════════════
 */

// Build production config từ DATABASE_URL nếu có
const buildProductionConfig = () => {
  const url = process.env.DATABASE_URL || process.env.MYSQL_URL;

  if (url) {
    // Mode 1: connection string (Railway)
    return {
      url,
      dialect:  "mysql",
      timezone: "+07:00",
    };
  }

  // Mode 2: từng env riêng (fallback)
  return {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT || 3306,
    dialect:  "mysql",
    timezone: "+07:00",
  };
};

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT || 3306,
    dialect:  "mysql",
    timezone: "+07:00",
  },
  production: buildProductionConfig(),
};