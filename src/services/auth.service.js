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

/**
 * Password reset token expiry — 1 GIỜ.
 *
 * Sensitive hơn verify nên expire nhanh hơn:
 *   - Email leak → attacker chỉ có 1h để dùng
 *   - User thường reset ngay khi nhận email
 *   - OWASP recommendation: 15-60 phút cho password reset
 */
const PASSWORD_RESET_TOKEN_EXPIRES_MS = 60 * 60 * 1000; // 1h

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
 * Generate token an toàn cho email verify / password reset.
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
const generateSecureToken = () => crypto.randomBytes(32).toString("hex");

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
 */
exports.register = async ({ name, email, password }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new AppError("Email already exists", 409);
  }

  const hashed = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const verificationToken          = generateSecureToken();
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
   * Đặt check NÀY SAU bcrypt compare để chống user enumeration.
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
    await deleteRefreshToken(decoded.id);
    throw new AppError("User not found", 401);
  }

  const newAccessToken  = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

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
 * @design IDEMPOTENT OPERATION — luôn return success.
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
 */
exports.verifyEmail = async ({ token }) => {
  if (!token) {
    throw new AppError("Verification token is required", 400);
  }

  const user = await User.findOne({ where: { verificationToken: token } });
  if (!user) {
    throw new AppError("Token không hợp lệ hoặc đã được sử dụng", 400);
  }

  if (
    !user.verificationTokenExpiresAt ||
    new Date() > new Date(user.verificationTokenExpiresAt)
  ) {
    await user.update({
      verificationToken:          null,
      verificationTokenExpiresAt: null,
    });
    throw new AppError("Token đã hết hạn. Vui lòng yêu cầu gửi lại link xác thực.", 400);
  }

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
 * @security Anti-enumeration: silent success nếu email không tồn tại.
 */
exports.resendVerificationEmail = async ({ email }) => {
  if (!email) {
    throw new AppError("Email is required", 400);
  }

  const user = await User.findOne({ where: { email } });

  if (!user) {
    logger.warn(`RESEND VERIFICATION: Email not found email=${email}`);
    return; // Silent success
  }

  if (user.isVerified) {
    throw new AppError("Email này đã được xác thực rồi", 400);
  }

  const verificationToken          = generateSecureToken();
  const verificationTokenExpiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRES_MS);

  await user.update({
    verificationToken,
    verificationTokenExpiresAt,
  });

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

// ════════════════════════════════════════════════════════════════════════════
// FORGOT / RESET PASSWORD (Phần 3)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Forgot password — gửi email reset password cho user.
 *
 * Flow:
 *   1. User submit email ở FE /forgot-password
 *   2. BE check email tồn tại trong DB
 *   3. Generate reset token + expiry 1h
 *   4. Save token vào DB
 *   5. Gửi email kèm link {FE}/reset-password?token=xxx
 *   6. Return success (kể cả khi email không tồn tại — anti-enumeration)
 *
 * @param {Object} payload
 * @param {string} payload.email
 * @returns {Promise<void>}
 *
 * @throws {AppError} 400 nếu thiếu email
 * @throws {AppError} 500 nếu email service fail (chỉ cho user TỒN TẠI)
 *
 * @security ANTI-ENUMERATION:
 *   - Nếu email không tồn tại → return success silent (không báo lỗi)
 *   - Nếu báo "email not found" → attacker dùng endpoint này để check
 *     email nào đã đăng ký trong hệ thống.
 *
 * @security Không cho reset nếu chưa verify email:
 *   Lý do: Nếu user A nhập sai email lúc đăng ký (email B của người khác),
 *   user B nhận được email reset → có thể chiếm tài khoản A.
 *   Bắt verify email trước khi cho reset → đảm bảo email là của user thật.
 */
exports.forgotPassword = async ({ email }) => {
  if (!email) {
    throw new AppError("Email is required", 400);
  }

  const user = await User.findOne({ where: { email } });

  /*
   * Anti-enumeration: Trả về success kể cả khi email không tồn tại.
   * Logger ghi lại để admin biết có ai đó probe endpoint này.
   */
  if (!user) {
    logger.warn(`FORGOT PASSWORD: Email not found email=${email}`);
    return; // Silent success
  }

  /*
   * Block reset nếu user chưa verify email.
   * Lý do bảo mật đã giải thích ở JSDoc trên.
   *
   * Vẫn return silent success thay vì throw error rõ ràng
   * để consistency với case email không tồn tại.
   */
  if (!user.isVerified) {
    logger.warn(`FORGOT PASSWORD: Email not verified email=${email}`);
    return; // Silent success
  }

  // Generate reset token + expiry
  const passwordResetToken     = generateSecureToken();
  const passwordResetExpiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRES_MS);

  await user.update({
    passwordResetToken,
    passwordResetExpiresAt,
  });

  try {
    await emailService.sendPasswordResetEmail({
      to:       user.email,
      userName: user.name,
      token:    passwordResetToken,
    });
    logger.info(`FORGOT PASSWORD SUCCESS: email=${email}`);
  } catch (err) {
    logger.error(`FORGOT PASSWORD FAILED: email=${email} error=${err.message}`);

    /*
     * Nếu email gửi fail, cleanup token để user request lại.
     * Throw error để FE biết và hiển thị retry.
     */
    await user.update({
      passwordResetToken:     null,
      passwordResetExpiresAt: null,
    });
    throw new AppError("Không thể gửi email. Vui lòng thử lại sau.", 500);
  }
};

/**
 * Reset password — set mật khẩu mới với token từ email.
 *
 * Flow:
 *   1. User click link trong email → mở FE /reset-password?token=xxx
 *   2. FE hiển thị form nhập mật khẩu mới
 *   3. FE submit POST {token, newPassword}
 *   4. BE verify token + check expiry
 *   5. BE hash password mới
 *   6. BE update DB: password mới + clear token
 *   7. BE clear ALL refresh tokens trong Redis (logout all devices)
 *   8. Return success → FE redirect về login
 *
 * @param {Object} payload
 * @param {string} payload.token       - Reset token từ query string
 * @param {string} payload.newPassword - Mật khẩu mới (đã được Joi validate)
 * @returns {Promise<{message, email}>}
 *
 * @throws {AppError} 400 nếu thiếu token/password
 * @throws {AppError} 400 nếu token invalid hoặc đã hết hạn
 *
 * @security 2 lý do clear all refresh tokens:
 *   1. User legitimate reset password (quên/lo ngại bảo mật)
 *      → Logout devices khác để chắc chắn không còn session cũ.
 *   2. Attacker đã chiếm session cũ
 *      → Reset password + revoke all sessions = đuổi attacker ra.
 */
exports.resetPassword = async ({ token, newPassword }) => {
  if (!token) {
    throw new AppError("Reset token is required", 400);
  }
  if (!newPassword) {
    throw new AppError("New password is required", 400);
  }

  // Tìm user theo reset token (có index nên query nhanh)
  const user = await User.findOne({ where: { passwordResetToken: token } });
  if (!user) {
    throw new AppError("Token không hợp lệ hoặc đã được sử dụng", 400);
  }

  // Check token có hết hạn chưa
  if (
    !user.passwordResetExpiresAt ||
    new Date() > new Date(user.passwordResetExpiresAt)
  ) {
    /*
     * Token expired → cleanup luôn để giữ DB sạch.
     * User cần request "Forgot password" lại để lấy token mới.
     */
    await user.update({
      passwordResetToken:     null,
      passwordResetExpiresAt: null,
    });
    throw new AppError(
      "Token đã hết hạn. Vui lòng yêu cầu đặt lại mật khẩu mới.",
      400
    );
  }

  // Hash password mới với salt rounds 12 (consistent toàn project)
  const hashed = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

  // Update password + clear reset token
  await user.update({
    password:               hashed,
    passwordResetToken:     null,
    passwordResetExpiresAt: null,
  });

  /*
   * SECURITY: Clear ALL refresh tokens của user → logout all devices.
   *
   * Hiện tại Redis schema lưu key `refresh:{userId}` — 1 user 1 token.
   * deleteRefreshToken(userId) xóa key này → tất cả device dùng refresh token
   * cũ sẽ bị reject ở endpoint /refresh.
   *
   * Khi triển khai multi-device session (Phần 5), structure sẽ thay đổi
   * thành `refresh:{userId}:{deviceId}` — lúc đó cần update logic này
   * để DEL theo pattern `refresh:{userId}:*`.
   */
  await deleteRefreshToken(user.id);

  logger.info(
    `PASSWORD RESET SUCCESS: email=${user.email} userId=${user.id} — all sessions revoked`
  );

  return {
    message: "Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.",
    email:   user.email,
  };
};

// ════════════════════════════════════════════════════════════════════════════
// CHANGE PASSWORD (Phần 4)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Change password — đổi mật khẩu khi user đã login.
 *
 * Flow:
 *   1. Lấy user từ DB theo userId (đã verify token ở middleware)
 *   2. Verify currentPassword bằng bcrypt.compare
 *   3. Check newPassword ≠ currentPassword (chống đổi-mà-không-đổi)
 *   4. Hash newPassword bằng bcrypt 12
 *   5. Update password trong DB
 *   6. Revoke ALL refresh tokens cũ (security)
 *   7. Cấp accessToken + refreshToken MỚI ngay (UX tốt — Option C)
 *   8. Save refreshToken mới vào Redis
 *   9. Return tokens mới + user info để FE update localStorage
 *
 * @param {Object} payload
 * @param {number} payload.userId           - ID từ JWT (req.user.id)
 * @param {string} payload.currentPassword
 * @param {string} payload.newPassword      - Đã được Joi validate password policy
 * @returns {Promise<{message, accessToken, refreshToken, user}>}
 *
 * @throws {AppError} 401 nếu currentPassword sai
 * @throws {AppError} 400 nếu newPassword === currentPassword
 * @throws {AppError} 404 nếu user không tồn tại (edge case khi user bị xóa
 *                       nhưng token chưa expire)
 *
 * @security OPTION C — Token rotation thay vì logout all:
 *   - Clear refresh token cũ trong Redis → các device khác bị logout khi gọi /refresh
 *   - Cấp tokens mới ngay → user hiện tại KHÔNG bị logout
 *   - FE nhận tokens mới → update localStorage → tiếp tục dùng bình thường
 *
 *   So với resetPassword (clear all + redirect login):
 *     - resetPassword: user QUÊN mật khẩu → đã không có session, OK redirect login
 *     - changePassword: user ĐANG có session → giữ session là UX hợp lý
 *
 * @security Acceptable trade-off với access token cũ:
 *   Access token cũ vẫn valid trong tối đa 15 phút (đến khi expire).
 *   Nhưng refresh token cũ đã bị revoke → attacker không thể refresh được.
 *   15 phút < session window thông thường → trade-off chấp nhận được.
 *
 * @future Khi triển khai multi-device session ở Phần 5:
 *   - Thay deleteRefreshToken(userId) bằng "clear all except current device"
 *   - Lúc đó user đổi password chỉ logout device khác, giữ device hiện tại
 *   - Hiện tại single-device nên cứ clear all rồi cấp lại = behavior tương đương
 */
exports.changePassword = async ({ userId, currentPassword, newPassword }) => {
  // Bước 1: Lấy user từ DB (cần password hash để verify)
  const user = await User.findByPk(userId);
  if (!user) {
    // Edge case: token valid nhưng user đã bị xóa khỏi DB
    throw new AppError("User not found", 404);
  }

  // Bước 2: Verify currentPassword
  const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentValid) {
    logger.warn(`CHANGE PASSWORD FAIL: Wrong current password userId=${userId}`);
    throw new AppError("Mật khẩu hiện tại không đúng", 401);
  }

  /*
   * Bước 3: Check newPassword ≠ currentPassword.
   *
   * Compare plaintext newPassword với hash trong DB:
   *   - Nếu match → user đang "đổi" thành chính password cũ → vô nghĩa, reject
   *   - Tránh user submit form mà thực ra không thay đổi gì
   *
   * Note: Joi đã check newPassword khác về structure (validation),
   *       còn đây là check semantic (đảm bảo thực sự có thay đổi).
   */
  const isSameAsCurrent = await bcrypt.compare(newPassword, user.password);
  if (isSameAsCurrent) {
    throw new AppError(
      "Mật khẩu mới phải khác mật khẩu hiện tại",
      400
    );
  }

  // Bước 4: Hash newPassword với salt rounds 12 (consistent toàn project)
  const hashed = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

  // Bước 5: Update password trong DB
  await user.update({ password: hashed });

  /*
   * Bước 6: Revoke refresh token cũ.
   *
   * Hiện tại schema Redis là `refresh:{userId}` — 1 user 1 token.
   * deleteRefreshToken(userId) xóa key → các device khác (nếu có) gọi /refresh
   * sẽ bị reject vì token cũ không còn trong Redis.
   *
   * Khi triển khai multi-device session ở Phần 5, structure sẽ thành
   * `refresh:{userId}:{deviceId}` — lúc đó cần update logic để DEL pattern
   * và NEU cần giữ device hiện tại thì exclude deviceId của nó.
   */
  await deleteRefreshToken(user.id);

  /*
   * Bước 7-8: Cấp tokens MỚI và save vào Redis.
   *
   * Đây là điểm khác biệt quan trọng với resetPassword:
   *   - resetPassword: clear all tokens → FE redirect về /login
   *   - changePassword: clear all + cấp tokens mới → FE giữ session hiện tại
   *
   * UX tốt hơn vì user đang authenticated, không có lý do phải logout họ.
   * Pattern này được dùng bởi GitHub, Google, AWS Console, etc.
   */
  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await setRefreshToken(user.id, refreshToken);

  logger.info(
    `CHANGE PASSWORD SUCCESS: email=${user.email} userId=${user.id} — tokens rotated`
  );

  // Bước 9: Return tokens mới + user info để FE update localStorage
  return {
    message: "Đổi mật khẩu thành công!",
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