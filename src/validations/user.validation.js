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

exports.createUserSchema = Joi.object({
  name:     Joi.string().min(3).max(100).required(),
  email:    Joi.string().email().required(),
  password: passwordSchema,
  age:      Joi.number().integer().min(1).max(120).optional(),
});

exports.updateUserSchema = Joi.object({
  name: Joi.string().min(3).max(100),
  age:  Joi.number().integer().min(1).max(120),
}).min(1).messages({
  "object.min": "Cần ít nhất 1 trường để update",
});

// ════════════════════════════════════════════════════════════════════════════
// AUTH SCHEMAS
// ════════════════════════════════════════════════════════════════════════════

exports.loginSchema = Joi.object({
  email:    Joi.string().email().required(),
  password: Joi.string().required(),
});

exports.registerSchema = Joi.object({
  name:     Joi.string().min(3).max(100).required(),
  email:    Joi.string().email().required(),
  password: passwordSchema,
});

/**
 * Schema cho POST /api/auth/resend-verification.
 * Chỉ cần email — không cần password.
 */
exports.resendVerificationSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email":  "Email không hợp lệ",
    "any.required":  "Email là bắt buộc",
    "string.empty":  "Email không được để trống",
  }),
});

/**
 * Schema cho POST /api/auth/forgot-password.
 * Chỉ cần email — gửi link reset về email user.
 */
exports.forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email":  "Email không hợp lệ",
    "any.required":  "Email là bắt buộc",
    "string.empty":  "Email không được để trống",
  }),
});

/**
 * Schema cho POST /api/auth/reset-password.
 * Cần token từ URL email + mật khẩu mới (apply password policy chung).
 */
exports.resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    "any.required": "Token là bắt buộc",
    "string.empty": "Token không được để trống",
  }),
  newPassword: passwordSchema,
});

// ════════════════════════════════════════════════════════════════════════════
// ORDER SCHEMAS
// ════════════════════════════════════════════════════════════════════════════

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