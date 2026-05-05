const nodemailer = require("nodemailer");
const logger     = require("../utils/logger");

// ════════════════════════════════════════════════════════════════════════════
// NODEMAILER CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════

/**
 * Nodemailer transporter cho Gmail SMTP.
 *
 * Configuration:
 *   - service: "gmail" → Nodemailer tự config host/port cho Gmail
 *   - auth.user: Gmail email từ .env
 *   - auth.pass: App Password 16 ký tự (KHÔNG dùng Gmail password thường)
 *
 * Free tier limits:
 *   - 500 emails/day
 *   - Đủ cho dev + demo + portfolio
 *
 * @security KHÔNG hardcode credentials. Đọc từ process.env.
 *           File .env phải có trong .gitignore (đã có).
 */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,     // VD: yourname@gmail.com
    pass: process.env.EMAIL_PASSWORD, // VD: abcdefghijklmnop (16 ký tự, KHÔNG dấu cách)
  },
});

// ════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ════════════════════════════════════════════════════════════════════════════

/**
 * Verify SMTP connection khi server khởi động.
 *
 * @note Không throw error nếu fail — server vẫn chạy được mà không cần email
 *       (graceful degradation). Logger sẽ warn để dev biết.
 *
 * Production tip: Có thể bỏ verify khi deploy để tránh delay startup.
 */
const verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    logger.info("Email transporter ready");
  } catch (err) {
    logger.warn(`Email transporter failed: ${err.message}`);
    logger.warn("Email features will not work — check EMAIL_USER and EMAIL_PASSWORD in .env");
  }
};

// Auto-verify khi module được require lần đầu
// Trong test environment thì skip để tránh fake credentials gây error
if (process.env.NODE_ENV !== "test") {
  verifyEmailConnection();
}

// ════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════════════

module.exports = {
  transporter,
  verifyEmailConnection,
};