


const logger = require("../utils/logger");

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status     = err.status     || "error";

  const isDev = process.env.NODE_ENV !== "production";

  // ✅ Log tất cả error
  logger.error(`${req.method} ${req.originalUrl} - ${err.message}\n${err.stack}`);

  // ─── Multer ───────────────────────────────────────────
  if (err.name === "MulterError" || err.message === "Only jpg, jpeg, png files are allowed") {
    return res.status(400).json({
      status: "error",
      message: err.message,
      data: null,
    });
  }

  // ─── JWT ─────────────────────────────────────────────
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      status: "error",
      message: "Invalid token",
      data: null,
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      status: "error",
      message: "Token expired",
      data: null,
    });
  }

  // ─── Sequelize Validation ─────────────────────────────
  // ✅ Xảy ra khi Joi/Sequelize validate fail ở tầng model
  if (err.name === "SequelizeValidationError") {
    return res.status(400).json({
      status: "error",
      message: err.errors.map((e) => e.message).join(", "),
      data: null,
    });
  }

  // ✅ Xảy ra khi insert trùng unique field (email, v.v.)
  if (err.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({
      status: "error",
      message: "Data already exists",
      data: null,
    });
  }

  // ✅ Xảy ra khi foreign key không tồn tại
  if (err.name === "SequelizeForeignKeyConstraintError") {
    return res.status(400).json({
      status: "error",
      message: "Related resource not found",
      data: null,
    });
  }

  // ─── Default ─────────────────────────────────────────
  /*
   * Phần 8 (Account Lockout) — Spread custom fields từ AppError vào response.
   *
   * Một số AppError có thêm field metadata (ngoài statusCode + message):
   *   - 423 Locked: { lockedUntil, minutesRemaining }
   *   - 401 Unauthorized (login fail): { attemptsRemaining }
   *
   * Whitelist các field được phép leak ra FE — KHÔNG dùng spread {...err}
   * vì sẽ leak cả `stack`, `name`, etc. (security risk).
   */
  const customFields = {};
  if (err.lockedUntil       !== undefined) customFields.lockedUntil       = err.lockedUntil;
  if (err.minutesRemaining  !== undefined) customFields.minutesRemaining  = err.minutesRemaining;
  if (err.attemptsRemaining !== undefined) customFields.attemptsRemaining = err.attemptsRemaining;

  res.status(err.statusCode).json({
    status:  err.status,
    message: err.message || "Internal Server Error",
    data:    null,
    ...customFields,
    // ✅ Chỉ trả stack trace khi development
    ...(isDev && { stack: err.stack }),
  });
};