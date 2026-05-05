const bcrypt   = require("bcrypt");
const crypto   = require("crypto");
const User     = require("../models/User");
const AppError = require("../utils/AppError");
const logger   = require("../utils/logger");
const emailService = require("./email.service");

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Bcrypt salt rounds — phải MATCH với BCRYPT_SALT_ROUNDS trong auth.service.js
 * để đảm bảo consistency khi user được tạo từ admin route vs register route.
 *
 * @see src/services/auth.service.js
 */
const BCRYPT_SALT_ROUNDS = 12;

/**
 * Verification token expiry — 24 giờ.
 * @see src/services/auth.service.js
 */
const VERIFICATION_TOKEN_EXPIRES_MS = 24 * 60 * 60 * 1000;

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Generate verification token an toàn cho email verify flow.
 * Duplicate logic từ auth.service.js để giữ user.service tự đứng được.
 */
const generateVerificationToken = () => crypto.randomBytes(32).toString("hex");

// ════════════════════════════════════════════════════════════════════════════
// CRUD OPERATIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Tạo user mới qua endpoint POST /api/users.
 *
 * Flow giống như register flow để giữ consistency:
 *   1. Check email unique
 *   2. Hash password (bcrypt 12)
 *   3. Generate verification token + expiry
 *   4. Create user với isVerified = false
 *   5. Gửi email verify (best-effort)
 *
 * @param {Object} payload - User data đã validate qua Joi
 * @returns {Promise<Object>} User DTO không bao gồm password
 *
 * @throws {AppError} 400 nếu email đã tồn tại
 *
 * @design Endpoint /api/users (legacy) và /api/auth/register cùng tạo user
 *         và đều gửi email verify. Frontend nên dùng /api/auth/register
 *         vì đó là endpoint chuẩn cho authentication flow.
 */
exports.createUser = async ({ name, email, password, age }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new AppError("Email already exists", 400);
  }

  const hashed = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  // Generate verification token + expiry
  const verificationToken          = generateVerificationToken();
  const verificationTokenExpiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRES_MS);

  const user = await User.create({
    name,
    email,
    password: hashed,
    age,
    role: "user",
    isVerified: false,
    verificationToken,
    verificationTokenExpiresAt,
  });

  logger.info(`USER CREATED: email=${email} userId=${user.id}`);

  /*
   * Gửi email verify — best-effort.
   * Wrap try-catch để KHÔNG throw lên controller.
   * User dùng "Resend verification" nếu email gửi fail.
   */
  try {
    await emailService.sendVerificationEmail({
      to:       email,
      userName: name,
      token:    verificationToken,
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
    age:        user.age,
    isVerified: user.isVerified,
  };
};

/**
 * Lấy danh sách tất cả users (admin only).
 * Không bao gồm password trong response.
 */
exports.getUsers = async () => {
  return User.findAll({
    attributes: ["id", "name", "email", "age", "role", "isVerified"],
  });
};

/**
 * Lấy thông tin user theo ID.
 *
 * @param {number|string} id - User ID từ req.params
 * @param {Object} requester - User đang request (req.user từ JWT)
 * @returns {Promise<Object>} User info
 *
 * @throws {AppError} 403 nếu không phải owner và không phải admin
 * @throws {AppError} 404 nếu user không tồn tại
 *
 * @security Ownership check ở service layer (Single Source of Truth).
 */
exports.getUserById = async (id, requester) => {
  if (requester.role !== "admin" && requester.id !== parseInt(id, 10)) {
    throw new AppError("Forbidden", 403);
  }

  const user = await User.findByPk(id, {
    attributes: ["id", "name", "email", "age", "role", "isVerified"],
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

/**
 * Update user info.
 *
 * @security Strip role và password khỏi body để chống:
 *           - Privilege escalation (user tự đổi role thành admin)
 *           - Password change qua route này (có route riêng /change-password)
 */
exports.updateUser = async (id, body, requester) => {
  if (requester.role !== "admin" && requester.id !== parseInt(id, 10)) {
    throw new AppError("Forbidden", 403);
  }

  const user = await User.findByPk(id);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const { role, password, ...allowedData } = body;
  await user.update(allowedData);

  return {
    id:    user.id,
    name:  user.name,
    email: user.email,
    age:   user.age,
  };
};

/**
 * Xóa user (admin only).
 *
 * @throws {AppError} 404 nếu user không tồn tại
 */
exports.deleteUser = async (id) => {
  const user = await User.findByPk(id);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  await user.destroy();
};

/**
 * Đổi role của user (admin only).
 *
 * @security Chặn admin tự demote chính mình → tránh case "lock out"
 *           khi chỉ có 1 admin trong hệ thống.
 */
exports.changeUserRole = async (targetId, role, requesterId) => {
  if (!["user", "admin"].includes(role)) {
    throw new AppError("Invalid role", 400);
  }

  const user = await User.findByPk(targetId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (requesterId === user.id) {
    throw new AppError("Cannot change your own role", 403);
  }

  user.role = role;
  await user.save();

  return {
    id:    user.id,
    email: user.email,
    role:  user.role,
  };
};