const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const logger     = require("../utils/logger");

// ════════════════════════════════════════════════════════════════════════════
// EMAIL CONFIGURATION — Dual-mode
// ════════════════════════════════════════════════════════════════════════════
//
// PRODUCTION  (Railway/cloud): dùng Resend HTTPS API (port 443)
//   → Bypass mọi cloud network restriction trên SMTP port (25/465/587).
//   → Free tier: 3000 emails/month, deliverability tốt hơn Gmail.
//
// DEVELOPMENT (local): dùng Nodemailer + Gmail SMTP
//   → Mạng nhà không bị chặn, không tốn quota Resend.
//   → 500 emails/day Gmail free, đủ cho dev/test.
//
// Cả 2 mode đều export hàm sendEmail({to, subject, html}) thống nhất,
// để email.service.js gọi không cần biết đang ở mode nào.
// ════════════════════════════════════════════════════════════════════════════

const isProduction = process.env.NODE_ENV === "production";

// Sender info — dùng chung cho cả 2 mode
const FROM_NAME    = process.env.EMAIL_FROM_NAME || "Backend Project";
const FROM_ADDRESS = isProduction
  // Production: nếu có domain verified → dùng. Không thì fallback "onboarding@resend.dev"
  // (test mode, chỉ gửi được tới chính email account Resend).
  ? (process.env.RESEND_FROM_ADDRESS || "onboarding@resend.dev")
  : process.env.EMAIL_USER;

// ════════════════════════════════════════════════════════════════════════════
// PRODUCTION: Resend client
// ════════════════════════════════════════════════════════════════════════════

let resendClient = null;
if (isProduction) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY missing — email sẽ không gửi được trong production");
  } else {
    resendClient = new Resend(apiKey);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// DEVELOPMENT: Nodemailer transporter (Gmail SMTP)
// ════════════════════════════════════════════════════════════════════════════

let nodemailerTransporter = null;
if (!isProduction) {
  nodemailerTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
}

// ════════════════════════════════════════════════════════════════════════════
// UNIFIED SEND FUNCTION
// ════════════════════════════════════════════════════════════════════════════

/**
 * Gửi email — tự pick provider theo NODE_ENV.
 *
 * @param {Object} payload
 * @param {string} payload.to       - Email người nhận
 * @param {string} payload.subject  - Tiêu đề
 * @param {string} payload.html     - Nội dung HTML
 *
 * @returns {Promise<{messageId: string}>}  - messageId để log/track
 * @throws {Error} Nếu provider trả lỗi (caller xử lý)
 */
const sendEmail = async ({ to, subject, html }) => {
  const fromHeader = `"${FROM_NAME}" <${FROM_ADDRESS}>`;

  if (isProduction) {
    // Resend API
    if (!resendClient) {
      throw new Error("Resend client chưa khởi tạo — kiểm tra RESEND_API_KEY");
    }

    const { data, error } = await resendClient.emails.send({
      from: fromHeader,
      to,
      subject,
      html,
    });

    if (error) {
      // Resend trả lỗi structured — wrap thành Error chuẩn
      throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
    }

    return { messageId: data?.id || "unknown" };
  }

  // Development: Nodemailer
  const info = await nodemailerTransporter.sendMail({
    from: fromHeader,
    to,
    subject,
    html,
  });
  return { messageId: info.messageId };
};

// ════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ════════════════════════════════════════════════════════════════════════════

const verifyEmailConnection = async () => {
  if (isProduction) {
    if (resendClient) {
      logger.info("Email transporter ready (Resend)");
    } else {
      logger.warn("Email features will not work — RESEND_API_KEY missing");
    }
    return;
  }

  // Dev: verify Nodemailer
  try {
    await nodemailerTransporter.verify();
    logger.info("Email transporter ready (Gmail SMTP)");
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
  sendEmail,
  verifyEmailConnection,

  // Backward compat: vài chỗ cũ có thể vẫn import { transporter }
  // → expose để không break, nhưng KHÔNG nên dùng trực tiếp ở code mới.
  // Production: KHÔNG có (Resend không phải Nodemailer transporter).
  transporter: nodemailerTransporter,
};