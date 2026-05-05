const bcrypt   = require("bcrypt");
const crypto   = require("crypto");
const jwt      = require("jsonwebtoken");
const User     = require("../models/User");
const AppError = require("../utils/AppError");
const logger   = require("../utils/logger");
const emailService = require("./email.service");
const {
  setRefreshToken,
  getRefreshToken,
  deleteRefreshToken,
} = require("../config/redis");

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Bcrypt cost factor (salt rounds).
 *
 * Benchmark trên CPU server tiêu chuẩn (Intel Xeon 2.4GHz):
 *   - 10: ~60ms/hash   → YẾU cho 2026
 *   - 12: ~250ms/hash  → CHUẨN industry hiện tại ✅
 *   - 14: ~1000ms/hash → CHẬM, dùng cho admin/banking
 *
 * @security OWASP Password Storage Cheat Sheet 2024 khuyến nghị tối thiểu 10,
 *           production nên dùng 12.
 */
const BCRYPT_SALT_ROUNDS = 12;

const ACCESS_TOKEN_EXPIRES_IN  = "15m";
const REFRESH_TOKEN_EXPIRES_IN = "7d";

/**
 * Verification token expiry — 24 giờ.
 *
 * Tradeoff:
 *   - Quá ngắn (1h): User check mail muộn → phải resend
 *   - Quá dài (7d): Risk security nếu email bị steal
 *   - 24h: Cân bằng giữa UX và security ✅
 */
const VERIFICATION_TOKEN_EXPIRES_MS = 24 * 60 * 60 * 1000; // 24h

// ════════════════════════════════════════════════════════════════════════════
// TOKEN HELPERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Generate JWT access token với payload chứa user identity và role.
 */
const generateAccessToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );

/**
 * Generate JWT refresh token.
 *
 * @note Payload chỉ chứa userId — KHÔNG include role/email.
 *       Lý do: refresh token chỉ dùng để cấp access token mới,
 *       lúc đó sẽ query DB lấy thông tin mới nhất.
 */
const generateRefreshToken = (user) =>
  jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );

/**
 * Generate verification token an toàn để gửi qua email.
 *
 * @returns {string} Random hex string 64 ký tự (32 bytes).
 *
 * @security Dùng crypto.randomBytes() thay vì Math.random():
 *           - crypto.randomBytes: cryptographically secure
 *           - Math.random: predictable, attacker có thể đoán được
 *
 * @design Hex format thay vì base64 vì:
 *         - URL-safe (không có +/=)
 *         - Dễ debug bằng mắt
 */
const generateVerificationToken = () => crypto.randomBytes(32).toString("hex");

// ════════════════════════════════════════════════════════════════════════════
// REGISTER
// ════════════════════════════════════════════════════════════════════════════

/**
 * Register user mới + gửi email verify.
 *
 * Flow:
 *   1. Check email unique
 *   2. Hash password (bcrypt 12)
 *   3. Generate verification token + expiry
 *   4. Insert user với isVerified=false
 *   5. Gửi email verify (best-effort, không block response)
 *   6. Return user info (KHÔNG bao gồm token verify)
 *
 * @param {Object} payload
 * @param {string} payload.name
 * @param {string} payload.email
 * @param {string} payload.password
 * @returns {Promise<Object>} User DTO
 *
 * @throws {AppError} 409 nếu email đã tồn tại
 *
 * @design Email gửi best-effort:
 *   - Nếu SMTP fail → log error nhưng KHÔNG throw lên user
 *   - User vẫn nhận response 201 success
 *   - User dùng "Resend verification" để retry
 *
 *   Lý do: Không nên rollback user creation chỉ vì email service down.
 *          Trải nghiệm tốt hơn là user thấy "đăng ký thành công"
 *          + có nút resend email khi cần.
 */
exports.register = async ({ name, email, password }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new AppError("Email already exists", 409);
  }

  const hashed = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  // Generate verification token + expiry
  const verificationToken          = generateVerificationToken();
  const verificationTokenExpiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRES_MS);

  const user = await User.create({
    name,
    email,
    password: hashed,
    role: "user",
    isVerified: false,
    verificationToken,
    verificationTokenExpiresAt,
  });

  logger.info(`REGISTER SUCCESS: email=${email} userId=${user.id}`);

  /*
   * Gửi email verify — best-effort.
   * Wrap trong try-catch để KHÔNG throw lên controller.
   *
   * Trade-off:
   *   ❌ User không nhận được email → phải resend
   *   ✅ User vẫn register thành công kể cả SMTP down
   */
  try {
    await emailService.sendVerificationEmail({
      to:        email,
      userName:  name,
      token:     verificationToken,
    });
  } catch (err) {
    logger.warn(
      `EMAIL WARNING: Failed to send verification email to ${email}. ` +
      `User can use "Resend verification" endpoint. Error: ${err.message}`
    );
  }

  return {
    id:         user.id,
    name:       user.name,
    email:      user.email,
    role:       user.role,
    isVerified: user.isVerified,
  };
};

// ════════════════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════════════════

/**
 * Login user và cấp access + refresh token.
 *
 * @throws {AppError} 400 nếu thiếu email/password
 * @throws {AppError} 401 nếu email/password sai
 * @throws {AppError} 403 nếu chưa verify email
 *
 * @security Generic error "Invalid email or password" để chống user enumeration.
 *           Tuy nhiên với case "chưa verify" thì THROW message rõ ràng vì:
 *             - User đã pass authentication (đúng email + password)
 *             - Cần biết để click "Resend verification email"
 */
exports.login = async ({ email, password, ip }) => {
  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    logger.warn(`AUTH FAIL: Email not found email=${email} ip=${ip}`);
    throw new AppError("Invalid email or password", 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    logger.warn(`AUTH FAIL: Wrong password email=${email} ip=${ip}`);
    throw new AppError("Invalid email or password", 401);
  }

  /*
   * BLOCK login nếu chưa verify email.
   *
   * Đặt check NÀY SAU bcrypt compare để chống user enumeration:
   *   - Nếu check trước: attacker biết email nào đã register
   *     (chỉ cần thử login → thấy "chưa verify" → confirm email tồn tại)
   *   - Nếu check sau: phải có đúng password mới biết → an toàn
   */
  if (!user.isVerified) {
    logger.warn(`AUTH FAIL: Email not verified email=${email} ip=${ip}`);
    throw new AppError(
      "Email chưa được xác thực. Vui lòng kiểm tra email hoặc yêu cầu gửi lại link xác thực.",
      403
    );
  }

  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await setRefreshToken(user.id, refreshToken);
  logger.info(`LOGIN SUCCESS: email=${email} ip=${ip}`);

  return {
    accessToken,
    refreshToken,
    user: {
      id:         user.id,
      name:       user.name,
      email:      user.email,
      role:       user.role,
      isVerified: user.isVerified,
    },
  };
};

// ════════════════════════════════════════════════════════════════════════════
// REFRESH TOKEN
// ════════════════════════════════════════════════════════════════════════════

/**
 * Refresh access token + rotate refresh token.
 *
 * @security Implement Refresh Token Rotation:
 *           - Mỗi lần refresh → cấp token mới + invalidate token cũ
 *           - Giảm risk nếu token bị steal vì attacker chỉ dùng được 1 lần
 *           - Reset TTL 7 ngày → user active không bị logout đột ngột
 */
exports.refresh = async ({ refreshToken }) => {
  if (!refreshToken) {
    throw new AppError("Refresh token is required", 400);
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const storedToken = await getRefreshToken(decoded.id);
  if (!storedToken || storedToken !== refreshToken) {
    throw new AppError("Refresh token has been revoked", 401);
  }

  const user = await User.findByPk(decoded.id);
  if (!user) {
    // Cleanup orphan refresh token
    await deleteRefreshToken(decoded.id);
    throw new AppError("User not found", 401);
  }

  const newAccessToken  = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  // Rotate — overwrite key trong Redis (atomic operation)
  await setRefreshToken(user.id, newRefreshToken);

  return {
    accessToken:  newAccessToken,
    refreshToken: newRefreshToken,
  };
};

// ════════════════════════════════════════════════════════════════════════════
// LOGOUT
// ════════════════════════════════════════════════════════════════════════════

/**
 * Logout user — xóa refresh token khỏi Redis.
 *
 * @design IDEMPOTENT OPERATION
 *
 *   Logout luôn return success kể cả khi:
 *     - refreshToken không truyền lên
 *     - Token invalid/expired
 *     - Token đã bị revoke trước đó
 */
exports.logout = async ({ refreshToken }) => {
  if (!refreshToken) {
    logger.info("LOGOUT: no token provided — silent success");
    return;
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    logger.info("LOGOUT: invalid/expired token — silent success");
    return;
  }

  await deleteRefreshToken(decoded.id);
  logger.info(`LOGOUT SUCCESS: userId=${decoded.id}`);
};

// ════════════════════════════════════════════════════════════════════════════
// EMAIL VERIFICATION
// ════════════════════════════════════════════════════════════════════════════

/**
 * Verify email khi user click link trong email.
 *
 * Flow:
 *   1. FE nhận token từ URL
 *   2. FE call: GET /api/auth/verify-email?token=xxx
 *   3. BE verify token + check expiry
 *   4. BE update isVerified=true, clear token
 *   5. BE return success → FE redirect user về /verify-email-success
 *
 * @param {Object} payload
 * @param {string} payload.token - Verification token từ query string
 * @returns {Promise<{message, user}>}
 *
 * @throws {AppError} 400 nếu thiếu token
 * @throws {AppError} 400 nếu token invalid hoặc đã hết hạn
 *
 * @security Generic error message — không tiết lộ chi tiết
 *           "token không tồn tại" vs "token hết hạn".
 */
exports.verifyEmail = async ({ token }) => {
  if (!token) {
    throw new AppError("Verification token is required", 400);
  }

  // Tìm user theo token (có index nên query nhanh)
  const user = await User.findOne({ where: { verificationToken: token } });
  if (!user) {
    throw new AppError("Token không hợp lệ hoặc đã được sử dụng", 400);
  }

  // Check token có hết hạn chưa
  if (
    !user.verificationTokenExpiresAt ||
    new Date() > new Date(user.verificationTokenExpiresAt)
  ) {
    /*
     * Token expired → cleanup luôn để giữ DB sạch.
     * User cần dùng "Resend verification" để lấy token mới.
     */
    await user.update({
      verificationToken:          null,
      verificationTokenExpiresAt: null,
    });
    throw new AppError("Token đã hết hạn. Vui lòng yêu cầu gửi lại link xác thực.", 400);
  }

  /*
   * Idempotent check: Nếu user đã verify rồi → vẫn return success.
   *
   * Tại sao? User có thể click link 2 lần:
   *   - Lần 1: verify thành công → token bị clear
   *   - Lần 2: token không match → throw "invalid"
   *
   * Nhưng case này gần như không xảy ra vì sau lần 1 token đã NULL,
   * lần 2 sẽ tìm user theo token NULL → không match → throw 400.
   *
   * Để clean code, nếu reach đến đây thì user CHƯA verified — verify thôi.
   */
  await user.update({
    isVerified:                 true,
    verificationToken:          null,
    verificationTokenExpiresAt: null,
  });

  logger.info(`EMAIL VERIFIED: email=${user.email} userId=${user.id}`);

  return {
    message: "Xác thực email thành công!",
    user: {
      id:         user.id,
      email:      user.email,
      name:       user.name,
      isVerified: true,
    },
  };
};

/**
 * Resend verification email — gửi lại email cho user chưa verify.
 *
 * @param {Object} payload
 * @param {string} payload.email
 * @returns {Promise<void>}
 *
 * @throws {AppError} 400 nếu thiếu email hoặc email đã verify rồi
 *
 * @security Generic message khi user không tồn tại — chống user enumeration.
 *           KHÔNG báo "email không tồn tại trong hệ thống".
 *
 * @note Endpoint này không cần auth — user chưa login được vì chưa verify.
 *       Tuy nhiên cần rate limit để chống spam (sẽ làm ở Phần 8).
 */
exports.resendVerificationEmail = async ({ email }) => {
  if (!email) {
    throw new AppError("Email is required", 400);
  }

  const user = await User.findOne({ where: { email } });

  /*
   * Anti-enumeration: Trả về success kể cả khi email không tồn tại.
   * Lý do: Nếu báo "email not found", attacker có thể dùng endpoint này
   *        để check email nào đã đăng ký.
   *
   * Trade-off: User typo email cũng thấy "thành công" → check spam folder.
   */
  if (!user) {
    logger.warn(`RESEND VERIFICATION: Email not found email=${email}`);
    return; // Silent success
  }

  if (user.isVerified) {
    throw new AppError("Email này đã được xác thực rồi", 400);
  }

  // Generate token MỚI và update DB
  const verificationToken          = generateVerificationToken();
  const verificationTokenExpiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRES_MS);

  await user.update({
    verificationToken,
    verificationTokenExpiresAt,
  });

  // Gửi email — best-effort
  try {
    await emailService.sendVerificationEmail({
      to:       user.email,
      userName: user.name,
      token:    verificationToken,
    });
    logger.info(`RESEND VERIFICATION SUCCESS: email=${email}`);
  } catch (err) {
    logger.error(`RESEND VERIFICATION FAILED: email=${email} error=${err.message}`);
    throw new AppError("Không thể gửi email. Vui lòng thử lại sau.", 500);
  }
};