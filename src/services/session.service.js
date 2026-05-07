const AppError = require("../utils/AppError");
const logger   = require("../utils/logger");
const {
  listSessions: redisListSessions,
  deleteSession,
  deleteOtherSessions,
} = require("../config/redis");

// ════════════════════════════════════════════════════════════════════════════
// SESSION SERVICE (Phần 5 — Multi-device)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Lấy danh sách tất cả sessions của user.
 *
 * @param {Object} payload
 * @param {number} payload.userId
 * @param {string} payload.currentDeviceId - Device đang gọi API → để mark "isCurrent"
 * @returns {Promise<Array>} Sessions kèm flag isCurrent
 *
 * @note KHÔNG trả refreshToken hay full userAgent ra response (security).
 *       Chỉ trả deviceName + masked IP + lastActive cho UX.
 */
exports.listSessions = async ({ userId, currentDeviceId }) => {
  const sessions = await redisListSessions(userId);

  return sessions.map((s) => ({
    deviceId:   s.deviceId,
    deviceName: s.deviceName,
    ip:         s.ip,
    createdAt:  s.createdAt,
    lastActive: s.lastActive,
    isCurrent:  s.deviceId === currentDeviceId,
  }));
};

/**
 * Logout 1 device cụ thể.
 *
 * @throws {AppError} 400 nếu user cố logout chính device hiện tại qua endpoint này
 *                   (phải dùng /auth/logout để logout self)
 */
exports.revokeSession = async ({ userId, targetDeviceId, currentDeviceId }) => {
  if (!targetDeviceId) {
    throw new AppError("Device ID is required", 400);
  }

  if (targetDeviceId === currentDeviceId) {
    throw new AppError(
      "Không thể đăng xuất thiết bị hiện tại qua endpoint này. Dùng /auth/logout.",
      400
    );
  }

  await deleteSession(userId, targetDeviceId);
  logger.info(
    `SESSION REVOKED: userId=${userId} targetDeviceId=${targetDeviceId} byDeviceId=${currentDeviceId}`
  );
};

/**
 * Logout tất cả devices KHÁC, giữ device hiện tại.
 */
exports.revokeOtherSessions = async ({ userId, currentDeviceId }) => {
  if (!currentDeviceId) {
    throw new AppError("Current device ID is required", 400);
  }

  await deleteOtherSessions(userId, currentDeviceId);
  logger.info(
    `OTHER SESSIONS REVOKED: userId=${userId} currentDeviceId=${currentDeviceId}`
  );
};