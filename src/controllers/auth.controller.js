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
 * Response 201 kể cả khi gửi email fail (user dùng "Resend" để retry).
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
 *
 * Login user. Trả 403 nếu chưa verify email.
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
 *
 *   1. Browser request (Accept: text/html):
 *      → Redirect 302 về frontend
 *      → Success: {FE}/verify-email-success
 *      → Error:   {FE}/verify-email-error?reason=invalid_token
 *
 *   2. API request (Accept: application/json hoặc query ?format=json):
 *      → Trả JSON như các endpoint khác
 *      → Dùng cho FE call API trực tiếp (SPA routing)
 *
 * @security Token nằm ở query string vì:
 *   - Email client gửi GET request → không thể POST
 *   - Token là single-use → nằm trong URL không leak gì khác (không phải password)
 *   - Sau khi verify thành công → token bị clear ngay
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

    // Redirect về FE success page
    return res.redirect(302, `${FRONTEND_URL}/verify-email-success`);
  } catch (err) {
    if (wantsJson) {
      throw err; // Để global error handler xử lý
    }

    /*
     * Redirect về FE error page với reason để FE hiển thị message phù hợp.
     *
     * Reasons:
     *   - missing_token: Không có token trong URL
     *   - invalid_token: Token không tồn tại trong DB (đã verify hoặc fake)
     *   - expired_token: Token đã hết hạn 24h
     */
    let reason = "invalid_token";
    if (err.message?.includes("required"))     reason = "missing_token";
    else if (err.message?.includes("hết hạn")) reason = "expired_token";

    return res.redirect(302, `${FRONTEND_URL}/verify-email-error?reason=${reason}`);
  }
});

/**
 * POST /api/auth/resend-verification
 *
 * Gửi lại email verify cho user chưa verify.
 *
 * @body { email: string }
 *
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