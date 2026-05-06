const authService      = require("../services/auth.service");
const catchAsync       = require("../utils/catchAsync");
const { sendResponse } = require("../utils/response");

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Frontend URL để redirect sau khi verify email.
 *
 * Flow redirect:
 *   - Verify thành công → {FRONTEND_URL}/verify-email-success
 *   - Verify thất bại   → {FRONTEND_URL}/verify-email-error?reason=xxx
 */
const FRONTEND_URL = process.env.CLIENT_URL || "http://localhost:5173";

// ════════════════════════════════════════════════════════════════════════════
// AUTH ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/auth/register
 *
 * Tạo user mới + gửi email verify.
 */
exports.register = catchAsync(async (req, res) => {
  const data = await authService.register(req.body);
  return sendResponse(
    res,
    201,
    "success",
    "Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.",
    data
  );
});

/**
 * POST /api/auth/login
 */
exports.login = catchAsync(async (req, res) => {
  const data = await authService.login({
    email:    req.body.email,
    password: req.body.password,
    ip:       req.ip,
  });
  return sendResponse(res, 200, "success", "Login successfully", data);
});

/**
 * POST /api/auth/refresh
 */
exports.refresh = catchAsync(async (req, res) => {
  const data = await authService.refresh({
    refreshToken: req.body.refreshToken,
  });
  return sendResponse(res, 200, "success", "Token refreshed", data);
});

/**
 * POST /api/auth/logout
 *
 * Idempotent — luôn return 200 kể cả với token invalid.
 */
exports.logout = catchAsync(async (req, res) => {
  await authService.logout({
    refreshToken: req.body.refreshToken,
  });
  return sendResponse(res, 200, "success", "Logged out successfully");
});

// ════════════════════════════════════════════════════════════════════════════
// EMAIL VERIFICATION ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/auth/verify-email?token=xxx
 *
 * Verify email khi user click link trong email.
 *
 * @design Hai response styles:
 *   1. Browser request → Redirect 302 về frontend
 *   2. API request (?format=json hoặc Accept: json) → JSON response
 */
exports.verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.query;
  const wantsJson = req.query.format === "json" ||
                    req.headers.accept?.includes("application/json");

  try {
    const data = await authService.verifyEmail({ token });

    if (wantsJson) {
      return sendResponse(res, 200, "success", data.message, data.user);
    }

    return res.redirect(302, `${FRONTEND_URL}/verify-email-success`);
  } catch (err) {
    if (wantsJson) {
      throw err;
    }

    let reason = "invalid_token";
    if (err.message?.includes("required"))     reason = "missing_token";
    else if (err.message?.includes("hết hạn")) reason = "expired_token";

    return res.redirect(302, `${FRONTEND_URL}/verify-email-error?reason=${reason}`);
  }
});

/**
 * POST /api/auth/resend-verification
 *
 * @body { email: string }
 * @note Anti-enumeration: Luôn return 200 kể cả email không tồn tại.
 */
exports.resendVerification = catchAsync(async (req, res) => {
  await authService.resendVerificationEmail({
    email: req.body.email,
  });
  return sendResponse(
    res,
    200,
    "success",
    "Nếu email tồn tại, link xác thực đã được gửi. Vui lòng kiểm tra hộp thư."
  );
});

// ════════════════════════════════════════════════════════════════════════════
// FORGOT / RESET PASSWORD ENDPOINTS (Phần 3)
// ════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/auth/forgot-password
 *
 * Gửi email reset password cho user.
 *
 * @body { email: string }
 *
 * @note Anti-enumeration: Luôn return 200 với message chung kể cả khi:
 *   - Email không tồn tại trong DB
 *   - User chưa verify email
 *   - Email gửi thành công
 *
 *   FE chỉ cần hiển thị "Nếu email tồn tại, chúng tôi đã gửi link reset"
 *   → user không biết email nào đã đăng ký.
 *
 * @note Rate limit 3/15min ở route layer.
 */
exports.forgotPassword = catchAsync(async (req, res) => {
  await authService.forgotPassword({
    email: req.body.email,
  });
  return sendResponse(
    res,
    200,
    "success",
    "Nếu email tồn tại, link đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư (kể cả thư mục Spam)."
  );
});

/**
 * POST /api/auth/reset-password
 *
 * Đặt lại mật khẩu mới với token từ email.
 *
 * @body { token: string, newPassword: string }
 *
 * @note Sau khi reset xong, ALL refresh tokens của user bị clear
 *       → user phải login lại trên TẤT CẢ devices.
 *       FE nên hiển thị message rõ ràng cho user biết.
 */
exports.resetPassword = catchAsync(async (req, res) => {
  const data = await authService.resetPassword({
    token:       req.body.token,
    newPassword: req.body.newPassword,
  });
  return sendResponse(res, 200, "success", data.message, {
    email: data.email,
  });
});