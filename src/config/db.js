const { Sequelize } = require("sequelize");

/*
 * ════════════════════════════════════════════════════════════════════════════
 * DUAL-MODE DATABASE CONFIG
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Hỗ trợ 2 cách config (theo độ ưu tiên):
 *
 *   1. DATABASE_URL hoặc MYSQL_URL  → connection string Railway/Heroku/Aiven
 *      VD: mysql://user:pass@host:port/dbname
 *
 *   2. DB_HOST + DB_PORT + DB_USER + DB_PASSWORD + DB_NAME  → local development
 *
 * Logic: nếu có URL → dùng URL, không thì fallback từng env riêng.
 * ════════════════════════════════════════════════════════════════════════════
 */

const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;

// Common options dùng chung cho cả 2 mode
const commonOptions = {
  dialect: "mysql",

  // Tắt log SQL trong production, bật trong development
  // eslint-disable-next-line no-console
  logging: process.env.NODE_ENV === "development" ? console.log : false,

  // Timezone Việt Nam — quan trọng khi server deploy ở region nước ngoài (Railway)
  timezone: "+07:00",

  /*
   * Connection pool — giảm xuống cho free tier (Railway $5 credit).
   * MySQL Railway free có max ~10 connections, chia cho nhiều process
   * + migration → để max=5 an toàn, tránh "Too many connections".
   */
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },

  // Tự động retry khi mất kết nối
  retry: {
    max: 3,
  },
};

let sequelize;

if (databaseUrl) {
  /*
   * Mode 1: Production (Railway/Aiven/Heroku) — parse từ connection string.
   * Sequelize tự parse format: mysql://user:pass@host:port/dbname
   */
  sequelize = new Sequelize(databaseUrl, commonOptions);
} else {
  /*
   * Mode 2: Local development — parse từng env riêng.
   */
  sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    ...commonOptions,
  });
}

module.exports = sequelize;
