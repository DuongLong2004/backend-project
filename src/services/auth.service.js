const bcrypt   = require("bcrypt");
const crypto   = require("crypto");
const jwt      = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User     = require("../models/User");
const AppError = require("../utils/AppError");
const logger   = require("../utils/logger");
const emailService = require("./email.service");
const {
  createSession,
  getSession,
  deleteSession,
  deleteAllSessions,
} = require("../config/redis");

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

const {
  BCRYPT_SALT_ROUNDS,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  VERIFICATION_TOKEN_EXPIRES_MS,
  PASSWORD_RESET_TOKEN_EXPIRES_MS,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MS,
} = require("../config/constants");

/**
 * Google OAuth2 client — dùng để verify ID token từ FE.
 *
 * @design Khởi tạo 1 lần ở module-level để reuse, không khởi tạo lại mỗi request.
 *         Library tự handle cache Google's public keys (JWKS) để verify chữ ký.
 *
 * @security verifyIdToken sẽ check chữ ký + audience + issuer + expiry tự động.
 */
const GOOGLE_OAUTH_CLIENT = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ════════════════════════════════════════════════════════════════════════════
// TOKEN HELPERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Generate JWT access token với payload chứa user identity, role, và deviceId.
 *
 * @param {Object} user      - User instance từ DB
 * @param {string} deviceId  - UUID của device (Phần 5 — multi-device session)
 *
 * @design Phần 5 thêm `deviceId` vào payload để middleware extract được
 *         → biết user đang dùng device nào → cần cho session-aware logic
 *         như list sessions, logout this device, v.v.
 *
 * @note Backward compat: Token cũ từ Phần 1-4 không có deviceId.
 *       Khi refresh, nếu decoded.deviceId === undefined → reject để force re-login.
 */
const generateAccessToken = (user, deviceId) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, deviceId },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );

/**
 * Generate JWT refresh token.
 *
 * @note Payload chỉ chứa userId + deviceId — KHÔNG include role/email.
 *       Lý do: refresh token chỉ dùng để cấp access token mới,
 *       lúc đó sẽ query DB lấy thông tin mới nhất.
 *
 * @param {Object} user      - User instance từ DB
 * @param {string} deviceId  - UUID của device (Phần 5)
 */
const generateRefreshToken = (user, deviceId) =>
  jwt.sign(
    { id: user.id, deviceId },
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


/**
 * Check tài khoản có đang bị khoá hay không (Phần 8).
 *
 * @param {Object} user - User instance từ DB
 * @returns {boolean} true nếu đang bị khoá (lockedUntil > now)
 *
 * @design Helper inline thay vì instance method để dễ test và reuse.
 *         Nếu lockedUntil = null hoặc < now → không bị khoá.
 */
const isAccountLocked = (user) => {
  return user.lockedUntil && new Date(user.lockedUntil) > new Date();
};

/**
 * Parse User-Agent string → friendly device name (Phần 5).
 *
 * @param {string} userAgent - Raw User-Agent header
 * @returns {string} VD: "Chrome on Windows", "Safari on iPhone"
 *
 * @example
 *   "Mozilla/5.0 (Windows NT 10.0)... Chrome/120" → "Chrome on Windows"
 *   "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)... Safari" → "Safari on iPhone"
 *
 * @note Dùng simple regex thay vì lib `ua-parser-js` để giảm dependencies.
 *       Đủ tốt cho UX hiển thị "Chrome on Windows" trong session manager.
 *       Nếu cần parse phức tạp hơn (model, version), upgrade sang ua-parser-js sau.
 */
const parseDeviceName = (userAgent = "") => {
  const ua = userAgent.toLowerCase();

  let browser = "Unknown Browser";
  if (ua.includes("edg/"))           browser = "Edge";
  else if (ua.includes("chrome/"))   browser = "Chrome";
  else if (ua.includes("firefox/"))  browser = "Firefox";
  else if (ua.includes("safari/"))   browser = "Safari";
  else if (ua.includes("opera") || ua.includes("opr/")) browser = "Opera";
  else if (ua.includes("postman"))   browser = "Postman";

  let os = "Unknown OS";
  if (ua.includes("windows"))   os = "Windows";
  else if (ua.includes("mac"))  os = "macOS";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  else if (ua.includes("android"))  os = "Android";
  else if (ua.includes("linux"))    os = "Linux";

  return `${browser} on ${os}`;
};

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
// LOGIN (Phần 5 — Multi-device + Phần 8 — Account Lockout)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Login user với multi-device session + account lockout.
 *
 * Flow Phần 5 + 8:
 *   1. Validate input email/password
 *   2. Tìm user trong DB → reject nếu không có (anti-enumeration)
 *   3. [Phần 8] Check account đang bị lock → reject 423 với time remaining
 *   4. [Phần 6] Check Google-only user → reject login bằng password
 *   5. Compare password bằng bcrypt:
 *      - SAI → tăng failedLoginAttempts:
 *           + Nếu đạt MAX (5) → set lockedUntil + gửi email cảnh báo
 *           + Throw 401 với attemptsRemaining (FE hiển thị warning)
 *      - ĐÚNG → reset counter + tiếp tục flow
 *   6. Check email đã verify chưa (Phần 2)
 *   7. Generate deviceId + tokens + create session (Phần 5)
 *
 * @param {Object} payload
 * @param {string} payload.email
 * @param {string} payload.password
 * @param {string} payload.ip          - req.ip
 * @param {string} payload.userAgent   - req.headers['user-agent']
 *
 * @returns {Promise<{accessToken, refreshToken, user}>}
 *
 * @throws {AppError} 400 nếu thiếu email/password
 * @throws {AppError} 401 nếu email/password sai (kèm attemptsRemaining nếu chưa lock)
 * @throws {AppError} 403 nếu chưa verify email
 * @throws {AppError} 423 (Locked) nếu account đang bị khoá — kèm minutesRemaining
 *
 * @security Anti-enumeration:
 *   - Generic error "Invalid email or password" cho cả email không tồn tại
 *     và password sai
 *   - Lock check chỉ thực hiện sau khi tìm thấy user → user không tồn tại
 *     không thể bị lock (không cần lock email không có thật)
 *
 * @security Counter chỉ tăng khi:
 *   - User TỒN TẠI trong DB (tránh attacker spam email không có để fill DB)
 *   - User CÓ password (Google-only user không có password để brute force)
 *   → Hai check này đứng TRƯỚC bcrypt.compare để bảo vệ resource.
 *
 * @design Q3=A: Reset counter về 0 khi login thành công.
 *         Trade-off: attacker đoán đúng pass cuối vẫn vào được, nhưng
 *         đơn giản hơn và phù hợp với user behavior thực tế (user thật
 *         hay gõ sai vài lần rồi nhớ ra password đúng).
 *
 * @design Q4=A: Gửi email cảnh báo khi lock — best-effort, không block flow.
 *         Email fail không ảnh hưởng đến việc account đã được lock trong DB.
 */
exports.login = async ({ email, password, ip, userAgent }) => {
  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    logger.warn(`AUTH FAIL: Email not found email=${email} ip=${ip}`);
    throw new AppError("Invalid email or password", 401);
  }

  /*
   * Phần 8 — Bước 3: Check account đang bị lock.
   *
   * Đặt check này NGAY SAU khi tìm user (trước cả Google-only check)
   * để tránh leak thông tin: nếu để check Google-only trước thì attacker
   * có thể phân biệt được user Google-only (không bao giờ bị lock) với
   * user thường (có thể bị lock).
   */
  if (isAccountLocked(user)) {
    const minutesRemaining = Math.ceil(
      (new Date(user.lockedUntil) - new Date()) / 60000
    );
    logger.warn(
      `AUTH FAIL: Account locked email=${email} ip=${ip} minutesRemaining=${minutesRemaining}`
    );

    /*
     * 423 Locked (RFC 4918): "The source or destination resource is locked".
     * Phù hợp hơn 401 vì đây không phải lỗi credentials, mà là policy block.
     * FE dùng status code này để hiển thị countdown thay vì error thường.
     */
    const error = new AppError(
      `Tài khoản tạm thời bị khoá do đăng nhập sai nhiều lần. Vui lòng thử lại sau ${minutesRemaining} phút.`,
      423
    );
    // Attach metadata cho FE hiển thị countdown chính xác
    error.lockedUntil      = user.lockedUntil;
    error.minutesRemaining = minutesRemaining;
    throw error;
  }

  /*
   * Phần 6: Block login bằng password nếu user là Google-only (chưa có password).
   * Tránh user bối rối khi không nhớ "đã đặt password cho account này chưa".
   *
   * Note: Google-only user KHÔNG tăng failedLoginAttempts vì không có password
   *       để brute force. Reject sớm tiết kiệm bcrypt CPU.
   */
  if (!user.password) {
    logger.warn(`AUTH FAIL: Google-only user trying password login email=${email}`);
    throw new AppError(
      "Tài khoản này được tạo bằng Google. Vui lòng đăng nhập với Google.",
      401
    );
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    /*
     * Phần 8 — Password SAI: Tăng counter, lock nếu đạt threshold.
     */
    const newAttempts = user.failedLoginAttempts + 1;
    const updates = { failedLoginAttempts: newAttempts };

    let shouldSendLockEmail = false;
    let lockUntil           = null;

    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      // Đạt threshold → lock account
      lockUntil          = new Date(Date.now() + LOCKOUT_DURATION_MS);
      updates.lockedUntil = lockUntil;
      shouldSendLockEmail = true;

      logger.warn(
        `ACCOUNT LOCKED: email=${email} ip=${ip} attempts=${newAttempts} unlockAt=${lockUntil.toISOString()}`
      );
    } else {
      logger.warn(
        `AUTH FAIL: Wrong password email=${email} ip=${ip} attempts=${newAttempts}/${MAX_LOGIN_ATTEMPTS}`
      );
    }

    await user.update(updates);

    /*
     * Best-effort gửi email cảnh báo (Q4=A).
     * Wrap try-catch để KHÔNG block flow lock — email fail vẫn lock được.
     */
    if (shouldSendLockEmail) {
      try {
        await emailService.sendAccountLockedEmail({
          to:             user.email,
          userName:       user.name,
          unlockTime:     lockUntil,
          maxAttempts:    MAX_LOGIN_ATTEMPTS,
          lockoutMinutes: Math.floor(LOCKOUT_DURATION_MS / 60000),
        });
      } catch (err) {
        logger.warn(
          `EMAIL WARNING: Failed to send lock notification to ${email}. ` +
          `Account is still locked. Error: ${err.message}`
        );
      }

      // Throw error 423 ngay (không cần đợi user thử lại)
      const error = new AppError(
        `Bạn đã nhập sai mật khẩu ${MAX_LOGIN_ATTEMPTS} lần. Tài khoản tạm khoá ${Math.floor(LOCKOUT_DURATION_MS / 60000)} phút. Email cảnh báo đã được gửi đến ${user.email}.`,
        423
      );
      error.lockedUntil      = lockUntil;
      error.minutesRemaining = Math.floor(LOCKOUT_DURATION_MS / 60000);
      throw error;
    }

    /*
     * Chưa đạt threshold → throw 401 kèm attemptsRemaining để FE hiển thị
     * warning "Bạn còn X lần thử trước khi tài khoản bị khoá".
     */
    const attemptsRemaining = MAX_LOGIN_ATTEMPTS - newAttempts;
    const error = new AppError("Invalid email or password", 401);
    error.attemptsRemaining = attemptsRemaining;
    throw error;
  }

  /*
   * Password ĐÚNG (Phần 8 — Q3=A): Reset counter về 0 + clear lockedUntil.
   *
   * Chỉ update DB khi cần (counter > 0 hoặc có lockedUntil) để tránh write
   * không cần thiết. Đa số login thành công thì counter đã = 0 từ trước.
   */
  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await user.update({
      failedLoginAttempts: 0,
      lockedUntil:         null,
    });
    logger.info(`AUTH RESET: Reset failed attempts for email=${email}`);
  }

  if (!user.isVerified) {
    logger.warn(`AUTH FAIL: Email not verified email=${email} ip=${ip}`);
    throw new AppError(
      "Email chưa được xác thực. Vui lòng kiểm tra email hoặc yêu cầu gửi lại link xác thực.",
      403
    );
  }

  // Phần 5: Generate deviceId mới + tạo session multi-device
  const deviceId    = crypto.randomUUID();
  const deviceName  = parseDeviceName(userAgent);
  const accessToken  = generateAccessToken(user, deviceId);
  const refreshToken = generateRefreshToken(user, deviceId);

  await createSession({
    userId: user.id,
    deviceId,
    refreshToken,
    deviceName,
    userAgent: userAgent || "Unknown",
    ip:        ip || "Unknown",
  });

  logger.info(
    `LOGIN SUCCESS: email=${email} ip=${ip} device="${deviceName}" deviceId=${deviceId}`
  );

  return {
    accessToken,
    refreshToken,
    user: {
      id:         user.id,
      name:       user.name,
      email:      user.email,
      role:       user.role,
      isVerified: user.isVerified,
      hasPassword: !!user.password, // FE dùng để biết Google-only user
    },
  };
};

// ════════════════════════════════════════════════════════════════════════════
// REFRESH TOKEN (Phần 5 — Multi-device)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Refresh access token với device-aware logic.
 *
 * Flow Phần 5:
 *   1. Decode refreshToken → lấy userId + deviceId
 *   2. Reject nếu token cũ Phần 1-4 không có deviceId (force re-login)
 *   3. Verify session tồn tại trong Redis (key: session:{userId}:{deviceId})
 *   4. Verify refreshToken trong session khớp với token gửi lên
 *   5. Issue tokens MỚI cho cùng deviceId (rotation)
 *   6. Update session với refreshToken mới + lastActive
 *
 * @security Implement Refresh Token Rotation:
 *   - Mỗi lần refresh → cấp token mới + lưu vào Redis (overwrite token cũ)
 *   - Nếu attacker reuse token cũ → mismatch với token trong Redis
 *     → revoke session ngay, log warning để admin biết có khả năng bị tấn công.
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

  const { id: userId, deviceId } = decoded;
  if (!deviceId) {
    /*
     * Token cũ (Phần 1-4) không có deviceId trong payload.
     * Reject để force re-login → user sẽ có session mới với multi-device support.
     */
    throw new AppError("Token format outdated, please login again", 401);
  }

  const session = await getSession(userId, deviceId);
  if (!session) {
    throw new AppError("Session has been revoked", 401);
  }

  if (session.refreshToken !== refreshToken) {
    /*
     * Token rotation security check:
     *   Nếu token gửi lên KHÁC token đang lưu trong Redis
     *   → có khả năng attacker đang dùng token cũ (đã rotate)
     *   → revoke session ngay để chặn attacker.
     *
     * Đây là dấu hiệu của "refresh token reuse attack" — best practice
     * khuyến nghị bởi OAuth 2.0 Security BCP.
     */
    await deleteSession(userId, deviceId);
    logger.warn(
      `REFRESH MISMATCH: Possible token reuse attack userId=${userId} deviceId=${deviceId}`
    );
    throw new AppError("Refresh token has been revoked", 401);
  }

  const user = await User.findByPk(userId);
  if (!user) {
    await deleteSession(userId, deviceId);
    throw new AppError("User not found", 401);
  }

  // Cấp tokens MỚI cho cùng deviceId (giữ nguyên session, chỉ rotate token)
  const newAccessToken  = generateAccessToken(user, deviceId);
  const newRefreshToken = generateRefreshToken(user, deviceId);

  // Update session: ghi đè refreshToken mới, giữ nguyên metadata
  await createSession({
    userId,
    deviceId,
    refreshToken: newRefreshToken,
    deviceName:   session.deviceName,
    userAgent:    session.userAgent,
    ip:           session.ip,
  });

  return {
    accessToken:  newAccessToken,
    refreshToken: newRefreshToken,
  };
};

// ════════════════════════════════════════════════════════════════════════════
// LOGOUT (Phần 5 — Multi-device)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Logout user — xóa session của device hiện tại.
 *
 * @design IDEMPOTENT OPERATION — luôn return success.
 *   - Token missing → silent success
 *   - Token invalid → silent success
 *   - Session không tồn tại → silent success
 *
 *   Lý do: Logout không nên bao giờ throw error. Theo RFC 7231, DELETE-like
 *   operation phải idempotent. User click logout 2 lần liên tiếp KHÔNG nên
 *   thấy lỗi ở lần thứ 2.
 *
 * @note Phần 5 chỉ xóa session của DEVICE HIỆN TẠI, không động devices khác.
 *       Để logout all devices khác → dùng endpoint DELETE /api/auth/sessions.
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

  const { id: userId, deviceId } = decoded;
  if (deviceId) {
    // Phần 5: Xóa đúng 1 session của device này
    await deleteSession(userId, deviceId);
    logger.info(`LOGOUT SUCCESS: userId=${userId} deviceId=${deviceId}`);
  } else {
    /*
     * Token cũ Phần 1-4 không có deviceId.
     * Fallback: xóa toàn bộ legacy + multi-device sessions để cleanup triệt để.
     */
    await deleteAllSessions(userId);
    logger.info(`LOGOUT SUCCESS (legacy): userId=${userId}`);
  }
};

// ════════════════════════════════════════════════════════════════════════════
// LOGIN WITH GOOGLE (Phần 6)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Login/Register với Google OAuth — verify ID token từ FE rồi cấp tokens.
 *
 * Flow:
 *   1. FE gửi `credential` (Google ID token) lên BE
 *   2. BE verify chữ ký + audience (ai phát hành token, có đúng cho app này không)
 *   3. Extract email + sub (Google ID) + name + picture từ payload
 *   4. Tìm user theo googleId → nếu có thì login luôn
 *   5. Nếu chưa có googleId → tìm theo email:
 *        a) Có user (đã đăng ký thường) → AUTO-LINK googleId vào user (Q2=A)
 *        b) Chưa có → tạo user mới (isVerified=true, password=null)
 *   6. Generate deviceId + tokens + create session (giống login thường)
 *
 * @param {Object} payload
 * @param {string} payload.credential - Google ID token (JWT) từ FE
 * @param {string} payload.ip
 * @param {string} payload.userAgent
 * @returns {Promise<{accessToken, refreshToken, user, isNewUser}>}
 *
 * @throws {AppError} 400 nếu thiếu credential
 * @throws {AppError} 401 nếu credential invalid (sai chữ ký, hết hạn, sai audience)
 * @throws {AppError} 403 nếu Google không xác thực email (rất hiếm)
 *
 * @security verifyIdToken sẽ:
 *   - Check chữ ký với Google's public keys (JWKS auto-cached)
 *   - Check `aud` (audience) khớp với GOOGLE_CLIENT_ID
 *   - Check `iss` (issuer) là accounts.google.com
 *   - Check `exp` (expiry) chưa hết hạn
 *   → Nếu bất kỳ check nào fail → throw error
 *
 * @design Q2=A — Auto-link: nếu user đã có account email/password rồi
 *   login Google cùng email → tự động gắn googleId vào user cũ.
 *   An toàn vì Google đã verify email = email thuộc về user thật.
 */
exports.loginWithGoogle = async ({ credential, ip, userAgent }) => {
  if (!credential) {
    throw new AppError("Google credential is required", 400);
  }

  // Bước 1-3: Verify ID token + extract payload
  let payload;
  try {
    const ticket = await GOOGLE_OAUTH_CLIENT.verifyIdToken({
      idToken:  credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    logger.warn(`GOOGLE AUTH FAIL: Invalid credential ip=${ip} error=${err.message}`);
    throw new AppError("Google credential không hợp lệ hoặc đã hết hạn", 401);
  }

  const {
    sub:            googleId,        // Google's unique user ID
    email,
    email_verified: emailVerified,
    name,
    picture,
  } = payload;

  if (!emailVerified) {
    /*
     * Edge case rất hiếm — Google luôn verify email trước khi cho phép
     * dùng OAuth. Nhưng vẫn check để chắc chắn không bị attacker fake.
     */
    logger.warn(`GOOGLE AUTH FAIL: Email not verified by Google email=${email}`);
    throw new AppError("Google chưa xác thực email này", 403);
  }

  // Bước 4: Tìm user theo googleId (đã link Google trước đó)
  let user = await User.findOne({ where: { googleId } });
  let isNewUser = false;

  if (!user) {
    // Bước 5: Chưa link → tìm theo email
    user = await User.findOne({ where: { email } });

    if (user) {
      /*
       * Bước 5a: Q2=A — Auto-link googleId vào account đã tồn tại.
       *
       * User đã đăng ký bằng email/password trước, giờ login Google
       * cùng email → coi như user xác nhận sở hữu cả 2 → link luôn.
       *
       * Sau khi link: user có thể login bằng password HOẶC Google.
       * Nếu user chưa verify email (đăng ký thường nhưng chưa click link),
       * giờ login Google cùng email → mark luôn isVerified=true vì Google
       * đã verify giúp.
       */
      await user.update({
        googleId,
        isVerified: true, // Google đã verify email → coi như đã verify
        avatar: user.avatar || picture, // Set avatar nếu chưa có
      });
      logger.info(
        `GOOGLE AUTH LINK: Linked googleId to existing user email=${email} userId=${user.id}`
      );
    } else {
      /*
       * Bước 5b: User hoàn toàn mới → tạo account.
       *
       * - password = NULL (Google-only user, có thể set password sau qua /change-password)
       * - isVerified = true (Google đã verify email)
       * - avatar = picture từ Google
       */
      user = await User.create({
        name:       name || email.split("@")[0],
        email,
        password:   null,
        googleId,
        role:       "user",
        isVerified: true,
        avatar:     picture || null,
      });
      isNewUser = true;
      logger.info(
        `GOOGLE AUTH NEW USER: email=${email} userId=${user.id}`
      );
    }
  }

  // Bước 6: Generate tokens + create session (giống login thường)
  const deviceId     = crypto.randomUUID();
  const deviceName   = parseDeviceName(userAgent);
  const accessToken  = generateAccessToken(user, deviceId);
  const refreshToken = generateRefreshToken(user, deviceId);

  await createSession({
    userId: user.id,
    deviceId,
    refreshToken,
    deviceName,
    userAgent: userAgent || "Unknown",
    ip:        ip || "Unknown",
  });

  logger.info(
    `GOOGLE LOGIN SUCCESS: email=${email} ip=${ip} device="${deviceName}" deviceId=${deviceId} isNewUser=${isNewUser}`
  );

  return {
    accessToken,
    refreshToken,
    isNewUser,
    user: {
      id:         user.id,
      name:       user.name,
      email:      user.email,
      role:       user.role,
      isVerified: user.isVerified,
      avatar:     user.avatar,
      hasPassword: !!user.password, // FE dùng để biết Google-only user
    },
  };
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
// FORGOT / RESET PASSWORD (Phần 3 — minor update Phần 5)
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

  /*
   * Phần 6: Google-only user không có password để reset.
   * Trả silent success (không lộ thông tin user dùng Google).
   */
  if (!user.password) {
    logger.warn(`FORGOT PASSWORD: Google-only user email=${email}`);
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
 *   7. BE clear ALL sessions của user (logout all devices) — Phần 5
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
 * @security 2 lý do clear all sessions:
 *   1. User legitimate reset password (quên/lo ngại bảo mật)
 *      → Logout devices khác để chắc chắn không còn session cũ.
 *   2. Attacker đã chiếm session cũ
 *      → Reset password + revoke all sessions = đuổi attacker ra.
 *
 *       bằng `deleteAllSessions(userId)` (multi-device). Behavior tương đương:
 *       cả 2 đều xóa toàn bộ refresh tokens của user.
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
   * SECURITY: Clear ALL sessions của user → logout all devices.
   *
   * Phần 5 schema: session:{userId}:{deviceId} (multi-device).
   * deleteAllSessions(userId) xóa TẤT CẢ keys match pattern session:{userId}:*
   * → tất cả device đang dùng token cũ sẽ bị reject ở endpoint /refresh.
   */
  await deleteAllSessions(user.id);

  logger.info(
    `PASSWORD RESET SUCCESS: email=${user.email} userId=${user.id} — all sessions revoked`
  );

  return {
    message: "Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.",
    email:   user.email,
  };
};

// ════════════════════════════════════════════════════════════════════════════
// CHANGE PASSWORD (Phần 4 — refactor Phần 5)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Change password — đổi mật khẩu khi user đã login.
 *
 * Flow Phần 5:
 *   1. Lấy user từ DB theo userId (đã verify token ở middleware)
 *   2. Verify currentPassword bằng bcrypt.compare
 *   3. Check newPassword ≠ currentPassword (chống đổi-mà-không-đổi)
 *   4. Hash newPassword bằng bcrypt 12
 *   5. Update password trong DB
 *   6. Revoke ALL sessions cũ (multi-device — Phần 5)
 *   7. Generate deviceId MỚI + cấp tokens mới (giống flow login)
 *   8. Save session mới vào Redis
 *   9. Return tokens mới + user info để FE update localStorage
 *
 * @param {Object} payload
 * @param {number} payload.userId           - ID từ JWT (req.user.id)
 * @param {string} payload.currentPassword
 * @param {string} payload.newPassword      - Đã được Joi validate password policy
 * @param {string} payload.ip               - req.ip cho metadata session mới
 * @param {string} payload.userAgent        - req.headers['user-agent']
 * @returns {Promise<{message, accessToken, refreshToken, user}>}
 *
 * @throws {AppError} 401 nếu currentPassword sai
 * @throws {AppError} 400 nếu newPassword === currentPassword
 * @throws {AppError} 404 nếu user không tồn tại (edge case khi user bị xóa
 *                       nhưng token chưa expire)
 *
 * @security OPTION C — Token rotation thay vì logout all:
 *   - Clear all sessions cũ → các device khác bị logout
 *   - Cấp deviceId + tokens MỚI → user hiện tại tiếp tục dùng app
 *   - FE nhận tokens mới → update localStorage → KHÔNG bị logout
 *
 *   So với resetPassword (clear all + redirect login):
 *     - resetPassword: user QUÊN mật khẩu → đã không có session, OK redirect login
 *     - changePassword: user ĐANG có session → giữ session là UX hợp lý
 *
 * @security Acceptable trade-off với access token cũ:
 *   Access token cũ (15m TTL) vẫn valid trong tối đa 15 phút.
 *   Nhưng refresh token cũ đã bị revoke → attacker không thể refresh.
 *   15 phút < session window thông thường → trade-off chấp nhận được.
 *
 * @note Phần 5 refactor:
 *   - Decision Q3=A: vẫn behavior "clear all + cấp mới" như Phần 4.
 *   - Implementation: dùng `deleteAllSessions` + `createSession` thay vì
 *   - Generate deviceId mới (UUID) cho session sau đổi password — coi như
 *     1 phiên login mới của device hiện tại.
 */
exports.changePassword = async ({
  userId,
  currentPassword,
  newPassword,
  ip,
  userAgent,
}) => {
  // Bước 1: Lấy user từ DB (cần password hash để verify)
  const user = await User.findByPk(userId);
  if (!user) {
    // Edge case: token valid nhưng user đã bị xóa khỏi DB
    throw new AppError("User not found", 404);
  }

  /*
   *  (Q3=B): Phân nhánh theo user có password hay chưa.
   *
   * Case A — Google-only user (user.password = null):
   *   → "Set password lần đầu" — KHÔNG cần currentPassword.
   *   → Sau khi set, user có thể login cả 2 cách (password + Google).
   *
   * Case B — User đã có password (đăng ký thường hoặc đã set password trước đó):
   *   → Flow cũ Phần 4: verify currentPassword + check newPassword khác.
   */
  const isGoogleOnlyUser = !user.password;

  if (isGoogleOnlyUser) {
    logger.info(
      `CHANGE PASSWORD: Setting password first time for Google-only user userId=${userId}`
    );
    // Skip verify — Google-only user không có password để verify
  } else {
    // Bước 2: Verify currentPassword
    if (!currentPassword) {
      throw new AppError("Mật khẩu hiện tại là bắt buộc", 400);
    }

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
  }

  // Bước 4: Hash newPassword với salt rounds 12 (consistent toàn project)
  const hashed = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

  // Bước 5: Update password trong DB
  await user.update({ password: hashed });

  /*
   * Bước 6: Revoke ALL sessions cũ (multi-device — Phần 5).
   *
   * deleteAllSessions xóa tất cả keys match pattern session:{userId}:*
   * → các device khác đang dùng token cũ sẽ bị reject ở /refresh.
   * → device hiện tại CŨNG bị xóa session, nhưng sẽ được tạo lại
   *   ngay bước 7-8 với deviceId mới.
   */
  await deleteAllSessions(user.id);

  /*
   * Bước 7-8: Generate deviceId mới + cấp tokens mới + save session.
   *
   * Đây là điểm khác biệt quan trọng với resetPassword:
   *   - resetPassword: clear all → FE redirect về /login (user phải login lại)
   *   - changePassword: clear all + cấp tokens mới → FE giữ session hiện tại
   *
   * UX tốt hơn vì user đang authenticated, không có lý do phải logout họ.
   * Pattern này được dùng bởi GitHub, Google, AWS Console, etc.
   */
  const deviceId    = crypto.randomUUID();
  const deviceName  = parseDeviceName(userAgent);
  const accessToken  = generateAccessToken(user, deviceId);
  const refreshToken = generateRefreshToken(user, deviceId);

  await createSession({
    userId: user.id,
    deviceId,
    refreshToken,
    deviceName,
    userAgent: userAgent || "Unknown",
    ip:        ip || "Unknown",
  });

  logger.info(
    `CHANGE PASSWORD SUCCESS: email=${user.email} userId=${user.id} — all sessions rotated, new deviceId=${deviceId}`
  );

  // Bước 9: Return tokens mới + user info để FE update localStorage
  return {
    message: isGoogleOnlyUser
      ? "Đặt mật khẩu thành công! Bây giờ bạn có thể đăng nhập bằng email/password."
      : "Đổi mật khẩu thành công!",
    accessToken,
    refreshToken,
    user: {
      id:         user.id,
      name:       user.name,
      email:      user.email,
      role:       user.role,
      isVerified: user.isVerified,
      hasPassword: true, // Sau changePassword luôn có password
    },
  };
};