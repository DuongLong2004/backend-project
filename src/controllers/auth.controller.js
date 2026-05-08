const authService      = require("../services/auth.service");
const catchAsync       = require("../utils/catchAsync");
const { sendResponse } = require("../utils/response");

const FRONTEND_URL = process.env.CLIENT_URL || "http://localhost:5173";

// ════════════════════════════════════════════════════════════════════════════
// AUTH ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════

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

exports.login = catchAsync(async (req, res) => {
  const data = await authService.login({
    email:     req.body.email,
    password:  req.body.password,
    ip:        req.ip,
    userAgent: req.headers["user-agent"],
  });
  return sendResponse(res, 200, "success", "Login successfully", data);
});

exports.refresh = catchAsync(async (req, res) => {
  const data = await authService.refresh({
    refreshToken: req.body.refreshToken,
  });
  return sendResponse(res, 200, "success", "Token refreshed", data);
});

exports.logout = catchAsync(async (req, res) => {
  await authService.logout({
    refreshToken: req.body.refreshToken,
  });
  return sendResponse(res, 200, "success", "Logged out successfully");
});

// ════════════════════════════════════════════════════════════════════════════
// EMAIL VERIFICATION
// ════════════════════════════════════════════════════════════════════════════

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
// FORGOT / RESET PASSWORD (Phần 3)
// ════════════════════════════════════════════════════════════════════════════

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

exports.resetPassword = catchAsync(async (req, res) => {
  const data = await authService.resetPassword({
    token:       req.body.token,
    newPassword: req.body.newPassword,
  });
  return sendResponse(res, 200, "success", data.message, {
    email: data.email,
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CHANGE PASSWORD (Phần 4)
// ════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/auth/change-password
 *
 * @auth Required (verifyToken middleware)
 * @body { currentPassword: string, newPassword: string }
 *
 * @returns 200 với { accessToken, refreshToken, user }
 *          → FE phải update localStorage với tokens mới
 *
 * @note Option C — User KHÔNG bị logout sau đổi password.
 *       Refresh tokens cũ đã bị revoke (chống session hijack),
 *       FE dùng tokens mới trong response để tiếp tục.
 */
exports.changePassword = catchAsync(async (req, res) => {
  const data = await authService.changePassword({
    userId:          req.user.id,
    currentPassword: req.body.currentPassword,
    newPassword:     req.body.newPassword,
    ip:              req.ip,
    userAgent:       req.headers["user-agent"],
  });
  return sendResponse(res, 200, "success", data.message, {
    accessToken:  data.accessToken,
    refreshToken: data.refreshToken,
    user:         data.user,
  });
});


// ════════════════════════════════════════════════════════════════════════════
// GOOGLE OAUTH 
// ════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/auth/google
 *
 * @body { credential: string } — Google ID token (JWT) từ FE @react-oauth/google
 * @returns 200 với { accessToken, refreshToken, user, isNewUser }
 *
 * Flow:
 *   1. User click "Đăng nhập với Google" → @react-oauth/google popup
 *   2. Google trả về `credential` (ID token)
 *   3. FE POST credential lên endpoint này
 *   4. BE verify ID token với Google → login/register user
 *   5. BE trả tokens → FE lưu localStorage + redirect home
 *
 * @note Phần 6 — không cần verifyToken middleware vì user chưa login.
 *       Endpoint này chính LÀ login flow.
 */
exports.googleLogin = catchAsync(async (req, res) => {
  const data = await authService.loginWithGoogle({
    credential: req.body.credential,
    ip:         req.ip,
    userAgent:  req.headers["user-agent"],
  });
  return sendResponse(
    res,
    200,
    "success",
    data.isNewUser ? "Đăng ký Google thành công!" : "Đăng nhập Google thành công!",
    {
      accessToken:  data.accessToken,
      refreshToken: data.refreshToken,
      isNewUser:    data.isNewUser,
      user:         data.user,
    }
  );
});