const { createClient } = require("redis");
const logger = require("../utils/logger");

const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 7; // 7 ngày, khớp với JWT expiresIn "7d"

const client = createClient({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT) || 6379,
  },
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
});

client.on("error", (err) => {
  logger.error(`Redis error: ${err.message}`);
});

client.on("connect", () => {
  logger.info("Redis connected");
});

const connectRedis = async () => {
  try {
    await client.connect();
  } catch (err) {
    logger.warn(`Redis connection failed: ${err.message} — running without cache`);
  }
};

connectRedis();

// ─── Refresh Token Helpers ────────────────────────────────────────────────────

/**
 * Lưu refresh token vào Redis với TTL 7 ngày.
 * Key format: refresh:{userId} — 1 user chỉ có 1 refresh token active tại 1 thời điểm.
 * Set lại key sẽ tự động overwrite token cũ và reset TTL.
 */
const setRefreshToken = async (userId, token) => {
  await client.setEx(`refresh:${userId}`, REFRESH_TOKEN_TTL, token);
};

/**
 * Lấy refresh token từ Redis theo userId.
 * Trả về token string hoặc null nếu không tồn tại / đã hết TTL.
 */
const getRefreshToken = async (userId) => {
  return client.get(`refresh:${userId}`);
};

/**
 * Xóa refresh token khỏi Redis — dùng khi logout hoặc rotate token.
 * Sau khi DEL, token cũ không thể dùng lại ngay cả khi chưa hết hạn JWT.
 */
const deleteRefreshToken = async (userId) => {
  await client.del(`refresh:${userId}`);
};

module.exports = {
  client,
  setRefreshToken,
  getRefreshToken,
  deleteRefreshToken,
};