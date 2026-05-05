const Joi = require("joi");

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Password policy — chuẩn production 2026.
 *
 * Quy tắc:
 *   - Tối thiểu 8 ký tự (NIST SP 800-63B recommendation)
 *   - Tối đa 128 ký tự (chống DoS attack qua bcrypt)
 *   - Ít nhất 1 chữ cái (a-z hoặc A-Z)
 *   - Ít nhất 1 số (0-9)
 *
 * Regex breakdown:
 *   (?=.*[A-Za-z])  → positive lookahead: phải có chữ cái
 *   (?=.*\d)        → positive lookahead: phải có số
 *   .{8,}           → match toàn bộ password ≥ 8 ký tự
 *
 * Lý do KHÔNG bắt ký tự đặc biệt:
 *   - NIST 2024 khuyến nghị KHÔNG bắt buộc complexity rules cứng nhắc
 *   - User thường chọn pattern dễ đoán: Password1! → Welcome1!
 *   - Password dài (passphrase) an toàn hơn password ngắn có ký tự đặc biệt
 *   - UX tốt hơn → giảm reset password requests
 */
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(PASSWORD_REGEX)
  .required()
  .messages({
    "string.min":          "Password phải có ít nhất 8 ký tự",
    "string.max":          "Password không được dài quá 128 ký tự",
    "string.pattern.base": "Password phải chứa ít nhất 1 chữ cái và 1 số",
    "any.required":        "Password là bắt buộc",
    "string.empty":        "Password không được để trống",
  });

// ════════════════════════════════════════════════════════════════════════════
// USER SCHEMAS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Schema cho POST /api/users (admin tạo user).
 * Áp dụng password policy mới.
 */
exports.createUserSchema = Joi.object({
  name:     Joi.string().min(3).max(100).required(),
  email:    Joi.string().email().required(),
  password: passwordSchema,
  age:      Joi.number().integer().min(1).max(120).optional(),
});

/**
 * Schema cho PUT /api/users/:id.
 * Không cho update password qua route này — có route riêng.
 */
exports.updateUserSchema = Joi.object({
  name: Joi.string().min(3).max(100),
  age:  Joi.number().integer().min(1).max(120),
}).min(1).messages({
  "object.min": "Cần ít nhất 1 trường để update",
});

// ════════════════════════════════════════════════════════════════════════════
// AUTH SCHEMAS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Schema cho POST /api/auth/login.
 *
 * @note KHÔNG validate password strength ở login.
 *       Lý do: User cũ đã đăng ký với password yếu (trước khi áp dụng
 *       policy mới) vẫn cần login được. Strength check chỉ áp dụng khi
 *       CREATE/CHANGE password.
 */
exports.loginSchema = Joi.object({
  email:    Joi.string().email().required(),
  password: Joi.string().required(),
});

/**
 * Schema cho POST /api/auth/register.
 * Áp dụng password policy mới — bắt buộc password mạnh cho user mới.
 */
exports.registerSchema = Joi.object({
  name:     Joi.string().min(3).max(100).required(),
  email:    Joi.string().email().required(),
  password: passwordSchema,
});

// ════════════════════════════════════════════════════════════════════════════
// ORDER SCHEMAS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Schema cho POST /api/orders.
 *
 * @note placementId allow(null) vì frontend gửi null khi sản phẩm không
 *       phải flash sale. Nếu không allow null → frontend phải xóa key,
 *       phức tạp hóa logic không cần thiết.
 */
exports.createOrderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId:   Joi.number().integer().positive().required(),
        quantity:    Joi.number().integer().min(1).max(100).required(),
        placementId: Joi.number().integer().positive().allow(null).optional(),
      })
    )
    .min(1)
    .required()
    .messages({
      "array.min": "Order must have at least 1 item",
    }),

  shippingInfo: Joi.object({
    name:    Joi.string().min(2).max(100).required(),
    phone:   Joi.string().pattern(/^[0-9]{9,11}$/).required().messages({
      "string.pattern.base": "Phone must be 9–11 digits",
    }),
    email:   Joi.string().email().required(),
    address: Joi.string().min(5).required(),
  }).required(),

  payMethod: Joi.string()
    .valid("cod", "banking", "momo")
    .default("cod"),
}).options({ convert: true });