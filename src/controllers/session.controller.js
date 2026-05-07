const sessionService   = require("../services/session.service");
const catchAsync       = require("../utils/catchAsync");
const { sendResponse } = require("../utils/response");

// ════════════════════════════════════════════════════════════════════════════
// SESSION CONTROLLER (Phần 5 — Multi-device)
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/auth/sessions
 *
 * Lấy danh sách thiết bị đang đăng nhập của user.
 *
 * @auth Required (verifyToken middleware)
 * @returns Array sessions với flag isCurrent cho device hiện tại
 */
exports.listSessions = catchAsync(async (req, res) => {
  const data = await sessionService.listSessions({
    userId:          req.user.id,
    currentDeviceId: req.user.deviceId,
  });
  return sendResponse(res, 200, "success", "OK", data);
});

/**
 * DELETE /api/auth/sessions/:deviceId
 *
 * Đăng xuất 1 thiết bị cụ thể (không được phép logout self qua endpoint này).
 *
 * @auth Required
 * @throws 400 nếu deviceId === current device (phải dùng /auth/logout)
 */
exports.revokeSession = catchAsync(async (req, res) => {
  await sessionService.revokeSession({
    userId:          req.user.id,
    targetDeviceId:  req.params.deviceId,
    currentDeviceId: req.user.deviceId,
  });
  return sendResponse(res, 200, "success", "Đã đăng xuất thiết bị thành công");
});

/**
 * DELETE /api/auth/sessions
 *
 * Đăng xuất khỏi TẤT CẢ thiết bị KHÁC (giữ thiết bị hiện tại).
 *
 * @auth Required
 */
exports.revokeOtherSessions = catchAsync(async (req, res) => {
  await sessionService.revokeOtherSessions({
    userId:          req.user.id,
    currentDeviceId: req.user.deviceId,
  });
  return sendResponse(res, 200, "success", "Đã đăng xuất khỏi tất cả thiết bị khác");
});