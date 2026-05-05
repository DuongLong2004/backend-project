const bcrypt   = require("bcrypt");
const User     = require("../models/User");
const AppError = require("../utils/AppError");

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

// ════════════════════════════════════════════════════════════════════════════
// CRUD OPERATIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Tạo user mới (admin endpoint).
 *
 * @param {Object} payload - User data đã validate qua Joi
 * @returns {Promise<Object>} User DTO không bao gồm password
 *
 * @throws {AppError} 400 nếu email đã tồn tại
 */
exports.createUser = async ({ name, email, password, age }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new AppError("Email already exists", 400);
  }

  const hashed = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  const user   = await User.create({
    name,
    email,
    password: hashed,
    age,
    role: "user",
  });

  return {
    id:    user.id,
    name:  user.name,
    email: user.email,
    age:   user.age,
  };
};

/**
 * Lấy danh sách tất cả users (admin only).
 * Không bao gồm password trong response.
 */
exports.getUsers = async () => {
  return User.findAll({
    attributes: ["id", "name", "email", "age", "role"],
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
 * @security Ownership check ở service layer thay vì route layer.
 *           Lý do: Service là Single Source of Truth cho business rules.
 *           Nếu thêm route mới gọi getUserById → tự động có authz check.
 */
exports.getUserById = async (id, requester) => {
  // parseInt vì id từ req.params là string, requester.id từ JWT là number
  if (requester.role !== "admin" && requester.id !== parseInt(id, 10)) {
    throw new AppError("Forbidden", 403);
  }

  const user = await User.findByPk(id, {
    attributes: ["id", "name", "email", "age", "role"],
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

/**
 * Update user info.
 *
 * @param {number|string} id      - User ID cần update
 * @param {Object}        body    - Data cần update
 * @param {Object}        requester - User đang request
 *
 * @throws {AppError} 403 nếu không phải owner và không phải admin
 * @throws {AppError} 404 nếu user không tồn tại
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

  // Whitelist fields — destructure để loại role và password ra
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
 *
 * @todo Soft delete thay vì hard delete để giữ history cho orders/reviews?
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
 * @param {number|string} targetId    - ID user cần đổi role
 * @param {string}        role        - Role mới (user|admin)
 * @param {number}        requesterId - ID admin đang thao tác
 *
 * @throws {AppError} 400 nếu role invalid
 * @throws {AppError} 403 nếu admin tự đổi role của chính mình
 * @throws {AppError} 404 nếu user không tồn tại
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