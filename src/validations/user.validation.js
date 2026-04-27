



const Joi = require("joi");

// ─── User ─────────────────────────────────────────────

exports.createUserSchema = Joi.object({
  name:     Joi.string().min(3).max(100).required(),
  email:    Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  age:      Joi.number().integer().min(1).max(120).optional(),
});

// ✅ Update không bắt buộc field nào, nhưng phải có ít nhất 1
exports.updateUserSchema = Joi.object({
  name: Joi.string().min(3).max(100),
  age:  Joi.number().integer().min(1).max(120),
}).min(1).messages({
  "object.min": "At least one field is required to update",
});

// ─── Order ───────────────────────────────────────────

exports.createOrderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.number().integer().positive().required(),
        quantity:  Joi.number().integer().min(1).required(),
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
});

// ─── Auth ────────────────────────────────────────────

exports.loginSchema = Joi.object({
  email:    Joi.string().email().required(),
  password: Joi.string().required(),
});

exports.registerSchema = Joi.object({
  name:     Joi.string().min(3).max(100).required(),
  email:    Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});