const { createClient } = require("redis");
const logger = require("../utils/logger");

// Tạo Redis client từ env
const client = createClient({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT) || 6379,
  },
  // Nếu Redis có password
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
});

client.on("error", (err) => {
  logger.error(`Redis error: ${err.message}`);
});

client.on("connect", () => {
  logger.info(" Redis connected");
});

// Connect khi app khởi động
const connectRedis = async () => {
  try {
    await client.connect();
  } catch (err) {
    // Không crash app nếu Redis lỗi — chỉ log warning
    // App vẫn chạy bình thường, chỉ không có cache
    logger.warn(`Redis connection failed: ${err.message} — running without cache`);
  }
};

connectRedis();

module.exports = client;