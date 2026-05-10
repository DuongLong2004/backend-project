const { createClient } = require("redis");
const logger = require("../utils/logger");

const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 7; // 7 ngày

/*
 * ════════════════════════════════════════════════════════════════════════════
 * DUAL-MODE REDIS CONFIG
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Hỗ trợ 2 cách config (theo độ ưu tiên):
 *
 *   1. REDIS_URL  → connection string Railway/Upstash
 *      VD: redis://default:password@host:port
 *      VD TLS: rediss://default:password@host:port
 *
 *   2. REDIS_HOST + REDIS_PORT + REDIS_PASSWORD  → local development
 *
 * Logic: nếu có URL → dùng URL, không thì fallback từng env riêng.
 * ════════════════════════════════════════════════════════════════════════════
 */

const redisUrl = process.env.REDIS_URL;

const clientOptions = redisUrl
  ? { url: redisUrl } // Mode 1: Production
  : {
      // Mode 2: Local development
      socket: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
      ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
    };

const client = createClient(clientOptions);

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

// ════════════════════════════════════════════════════════════════════════════
// SESSION KEY HELPERS (Phần 5 — Multi-device)
// ════════════════════════════════════════════════════════════════════════════

/*
 * Schema mới (Phần 5):
 *   session:{userId}:{deviceId} = JSON {
 *     refreshToken,
 *     deviceName,
 *     userAgent,
 *     ip,
 *     createdAt,
 *     lastActive
 *   }
 *
 * Schema cũ (Phần 1-4):
 *   refresh:{userId} = string (refreshToken)
 *
 * Migration: Schema cũ vẫn được support qua các function legacy
 *            (setRefreshToken, getRefreshToken, deleteRefreshToken)
 *            để các flow CHƯA migrate (Phần 4 changePassword) vẫn chạy được.
 *            Sau khi auth.service.js migrate xong toàn bộ → có thể xóa legacy.
 */

const sessionKey = (userId, deviceId) => `session:${userId}:${deviceId}`;
const sessionPattern = (userId) => `session:${userId}:*`;

// ════════════════════════════════════════════════════════════════════════════
// SESSION OPERATIONS — Multi-device (Phần 5)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Tạo hoặc cập nhật 1 session cho user trên 1 device cụ thể.
 *
 * @param {Object} payload
 * @param {number} payload.userId
 * @param {string} payload.deviceId      - UUID của device
 * @param {string} payload.refreshToken
 * @param {string} payload.deviceName    - VD: "Chrome on Windows"
 * @param {string} payload.userAgent     - Raw User-Agent header
 * @param {string} payload.ip            - IP address
 * @returns {Promise<void>}
 *
 * @design TTL = 7 ngày trùng với refreshToken expiry → key tự xóa khi token hết hạn.
 */
const createSession = async ({
  userId,
  deviceId,
  refreshToken,
  deviceName,
  userAgent,
  ip,
}) => {
  const now = new Date().toISOString();
  const data = {
    refreshToken,
    deviceName,
    userAgent,
    ip,
    createdAt: now,
    lastActive: now,
  };
  await client.setEx(sessionKey(userId, deviceId), REFRESH_TOKEN_TTL, JSON.stringify(data));
};

/**
 * Lấy 1 session theo userId + deviceId.
 * @returns {Promise<Object|null>} Session data hoặc null nếu không tồn tại.
 */
const getSession = async (userId, deviceId) => {
  const raw = await client.get(sessionKey(userId, deviceId));
  return raw ? JSON.parse(raw) : null;
};

/**
 * Update lastActive của session (gọi mỗi khi user dùng refresh token).
 * Re-set TTL về 7 ngày để session active không bị expire.
 */
const touchSession = async (userId, deviceId) => {
  const session = await getSession(userId, deviceId);
  if (!session) return;
  session.lastActive = new Date().toISOString();
  await client.setEx(sessionKey(userId, deviceId), REFRESH_TOKEN_TTL, JSON.stringify(session));
};

/**
 * Xóa 1 session cụ thể (logout 1 device).
 */
const deleteSession = async (userId, deviceId) => {
  await client.del(sessionKey(userId, deviceId));
};

/**
 * List tất cả sessions của 1 user.
 * @returns {Promise<Array>} [{ deviceId, deviceName, ip, userAgent, createdAt, lastActive }]
 *
 * @note KHÔNG trả về refreshToken trong response (security).
 */
const listSessions = async (userId) => {
  const keys = await client.keys(sessionPattern(userId));
  if (keys.length === 0) return [];

  const sessions = await Promise.all(
    keys.map(async (key) => {
      const raw = await client.get(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const deviceId = key.split(":")[2]; // session:{userId}:{deviceId}
      return {
        deviceId,
        deviceName: data.deviceName,
        ip:         data.ip,
        userAgent:  data.userAgent,
        createdAt:  data.createdAt,
        lastActive: data.lastActive,
      };
    })
  );

  return sessions.filter(Boolean).sort((a, b) =>
    new Date(b.lastActive) - new Date(a.lastActive)
  );
};

/**
 * Xóa TẤT CẢ sessions của user (logout all devices).
 * Dùng cho: resetPassword, account compromise.
 */
const deleteAllSessions = async (userId) => {
  const keys = await client.keys(sessionPattern(userId));
  if (keys.length > 0) {
    await client.del(keys);
  }
};

/**
 * Xóa tất cả sessions TRỪ 1 device cụ thể (logout other devices).
 * Dùng cho: "Đăng xuất khỏi tất cả thiết bị khác" trong Profile.
 */
const deleteOtherSessions = async (userId, keepDeviceId) => {
  const keys = await client.keys(sessionPattern(userId));
  const keepKey = sessionKey(userId, keepDeviceId);
  const toDelete = keys.filter((k) => k !== keepKey);
  if (toDelete.length > 0) {
    await client.del(toDelete);
  }
};

// ════════════════════════════════════════════════════════════════════════════
// LEGACY HELPERS — backward compat với schema cũ
// ════════════════════════════════════════════════════════════════════════════

/*
 * Các function dưới đây giữ lại để code cũ (chưa migrate sang multi-device)
 * vẫn chạy được, tránh break tests + flows hiện hữu.
 *
 * Sau khi auth.service.js migrate XONG toàn bộ → có thể xóa block này.
 */

const setRefreshToken = async (userId, token) => {
  await client.setEx(`refresh:${userId}`, REFRESH_TOKEN_TTL, token);
};

const getRefreshToken = async (userId) => {
  return client.get(`refresh:${userId}`);
};

const deleteRefreshToken = async (userId) => {
  // Xóa CẢ legacy key VÀ tất cả session keys multi-device của user
  await client.del(`refresh:${userId}`);
  await deleteAllSessions(userId);
};

// ════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════════════

module.exports = {
  client,

  // Multi-device session API (Phần 5)
  createSession,
  getSession,
  touchSession,
  deleteSession,
  listSessions,
  deleteAllSessions,
  deleteOtherSessions,

  // Legacy API (Phần 1-4 backward compat)
  setRefreshToken,
  getRefreshToken,
  deleteRefreshToken,
};