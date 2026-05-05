const bcrypt   = require("bcrypt");
const jwt      = require("jsonwebtoken");
const User     = require("../models/User");
const AppError = require("../utils/AppError");
const logger   = require("../utils/logger");
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
 * @note User cũ trong DB hash với salt rounds = 10 vẫn login được.
 *       Bcrypt embed salt rounds vào hash output ($2b$10$... vs $2b$12$...)
 *       nên bcrypt.compare() tự nhận diện và xử lý đúng.
 *
 * @security OWASP Password Storage Cheat Sheet 2024 khuyến nghị tối thiểu 10,
 *           production nên dùng 12.
 */
const BCRYPT_SALT_ROUNDS = 12;

const ACCESS_TOKEN_EXPIRES_IN  = "15m";
const REFRESH_TOKEN_EXPIRES_IN = "7d";

// ════════════════════════════════════════════════════════════════════════════
// TOKEN HELPERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Generate JWT access token với payload chứa user identity và role.
 *
 * @param {Object} user - User instance từ Sequelize
 * @returns {string} Signed JWT token
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
 *       Nếu role/email đã đổi → access token mới sẽ reflect đúng.
 */
const generateRefreshToken = (user) =>
  jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );

// ════════════════════════════════════════════════════════════════════════════
// REGISTER
// ════════════════════════════════════════════════════════════════════════════

/**
 * Register user mới.
 *
 * @param {Object} payload
 * @param {string} payload.name     - Tên hiển thị (đã validate qua Joi)
 * @param {string} payload.email    - Email unique (đã validate qua Joi)
 * @param {string} payload.password - Password đã pass strength check
 * @returns {Promise<Object>} User info (không bao gồm password)
 *
 * @throws {AppError} 409 nếu email đã tồn tại
 *
 * @note Validation đã được handle ở route middleware (registerSchema).
 *       Service KHÔNG check lại name/email/password presence để tránh
 *       duplicate validation logic. Single Source of Truth principle.
 */
exports.register = async ({ name, email, password }) => {
  // Check email duplicate — case-sensitive theo cách Sequelize default
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new AppError("Email already exists", 409);
  }

  // Hash password với salt rounds 12 (~250ms — acceptable cho register)
  const hashed = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const user = await User.create({
    name,
    email,
    password: hashed,
    role: "user", // Default role — không cho client truyền role để tránh privilege escalation
  });

  logger.info(`REGISTER SUCCESS: email=${email}`);

  // Trả về DTO — KHÔNG bao giờ trả password (kể cả hashed)
  return {
    id:    user.id,
    name:  user.name,
    email: user.email,
    role:  user.role,
  };
};

// ════════════════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════════════════

/**
 * Login user và cấp access + refresh token.
 *
 * @param {Object} payload
 * @param {string} payload.email
 * @param {string} payload.password
 * @param {string} payload.ip - IP của client (req.ip) — dùng cho audit log
 * @returns {Promise<{accessToken, refreshToken, user}>}
 *
 * @throws {AppError} 400 nếu thiếu email/password
 * @throws {AppError} 401 nếu email/password sai
 *
 * @security Sử dụng generic error message "Invalid email or password"
 *           cho cả 2 case (email không tồn tại / password sai) để tránh
 *           user enumeration attack.
 */
exports.login = async ({ email, password, ip }) => {
  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    // Log audit trail — không expose cho client
    logger.warn(`AUTH FAIL: Email not found email=${email} ip=${ip}`);
    throw new AppError("Invalid email or password", 401);
  }

  /*
   * bcrypt.compare() tự động extract salt từ hash → support tốt
   * cho user cũ (salt 10) và user mới (salt 12) cùng lúc.
   */
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    logger.warn(`AUTH FAIL: Wrong password email=${email} ip=${ip}`);
    throw new AppError("Invalid email or password", 401);
  }

  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  /*
   * Lưu refresh token vào Redis với TTL 7 ngày khớp JWT expiresIn.
   *
   * Key strategy: refresh:{userId} — single session per user.
   * Trade-off:
   *    Đơn giản, dễ track
   *    Login từ device mới → tự động kick device cũ (security feature)
   *    Không support multi-device login
   *
   * @todo Phần 5 sẽ refactor thành multi-device support.
   */
  await setRefreshToken(user.id, refreshToken);

  logger.info(`LOGIN SUCCESS: email=${email} ip=${ip}`);

  return {
    accessToken,
    refreshToken,
    user: {
      id:    user.id,
      name:  user.name,
      email: user.email,
      role:  user.role,
    },
  };
};

// ════════════════════════════════════════════════════════════════════════════
// REFRESH TOKEN
// ════════════════════════════════════════════════════════════════════════════

/**
 * Refresh access token + rotate refresh token.
 *
 * @param {Object} payload
 * @param {string} payload.refreshToken - Refresh token từ client
 * @returns {Promise<{accessToken, refreshToken}>}
 *
 * @throws {AppError} 400 nếu thiếu refreshToken
 * @throws {AppError} 401 nếu token invalid/expired/revoked hoặc user bị xóa
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

  // Step 1: Verify chữ ký + expiry của JWT
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  /*
   * Step 2: Check token có trong Redis không.
   *
   * Trường hợp token bị revoke (logout / rotate):
   *   - Redis đã DEL key → getRefreshToken() trả null
   *   - Hoặc key đã được overwrite bằng token mới (sau rotate)
   *
   * Strict equality check (storedToken !== refreshToken) để chặn
   * attacker dùng token cũ sau khi đã rotate.
   */
  const storedToken = await getRefreshToken(decoded.id);
  if (!storedToken || storedToken !== refreshToken) {
    throw new AppError("Refresh token has been revoked", 401);
  }

  // Step 3: Lấy user info mới nhất từ DB
  const user = await User.findByPk(decoded.id);
  if (!user) {
    /*
     * BUG FIX: Cleanup orphan refresh token.
     *
     * Trước đây: User bị xóa nhưng refresh token vẫn ở Redis → memory leak.
     * Bây giờ: Detect missing user → cleanup ngay trước khi throw.
     */
    await deleteRefreshToken(decoded.id);
    throw new AppError("User not found", 401);
  }

  // Step 4: Generate token cặp mới
  const newAccessToken  = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  // Step 5: Rotate — overwrite key trong Redis (atomic operation)
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
 * @param {Object} payload
 * @param {string} [payload.refreshToken] - Refresh token (optional)
 * @returns {Promise<void>}
 *
 * @design IDEMPOTENT OPERATION
 *
 *   Logout luôn return success kể cả khi:
 *     - refreshToken không truyền lên
 *     - Token invalid/expired
 *     - Token đã bị revoke trước đó
 *
 *   Lý do thiết kế:
 *     1. UX: User click "Đăng xuất" → mong muốn KẾT QUẢ (session bị xóa).
 *        Nếu token đã invalid → session đã chết → đáng lẽ là success.
 *
 *     2. REST best practice: DELETE/logout operations SHOULD be idempotent
 *        (RFC 7231). Gọi 2 lần trên 1 token → cả 2 đều thành công.
 *
 *     3. Security: Trả lỗi 400 không tăng security mà còn leak thông tin
 *        về trạng thái token cho attacker.
 *
 * @note Function này không throw bất kỳ lỗi nào — controller luôn return 200.
 */
exports.logout = async ({ refreshToken }) => {
  // Case 1: Không có token → silent success
  if (!refreshToken) {
    logger.info("LOGOUT: no token provided — silent success");
    return;
  }

  // Case 2: Token invalid/expired → silent success
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    logger.info("LOGOUT: invalid/expired token — silent success");
    return;
  }

  /*
   * Case 3: Token valid → xóa khỏi Redis.
   *
   * Best-effort delete: Redis DEL không throw nếu key không tồn tại
   * (trả về 0 thay vì error) → an toàn để gọi mà không cần check trước.
   */
  await deleteRefreshToken(decoded.id);
  logger.info(`LOGOUT SUCCESS: userId=${decoded.id}`);
};