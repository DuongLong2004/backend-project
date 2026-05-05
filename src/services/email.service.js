const { transporter } = require("../config/email");
const logger          = require("../utils/logger");

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Sender info — hiển thị trong email user nhận được.
 *
 * Format: "Display Name <email@gmail.com>"
 * - Display Name: Tên brand hiển thị (vd: "Backend Project")
 * - Email: Phải MATCH với EMAIL_USER trong .env, không được khác
 */
const FROM_NAME    = process.env.EMAIL_FROM_NAME || "Backend Project";
const FROM_ADDRESS = process.env.EMAIL_USER;

/**
 * Frontend URL — base URL để generate verify link.
 *
 * Flow:
 *   1. BE generate URL: {FRONTEND_URL}/verify-email?token=xxx
 *   2. User click link trong email → mở FE
 *   3. FE đọc token từ query string → call API: GET /api/auth/verify-email?token=xxx
 *   4. BE verify token → redirect về FE: {FRONTEND_URL}/verify-email-success
 *
 * Mặc định: http://localhost:5173 (Vite default port)
 */
const FRONTEND_URL = process.env.CLIENT_URL || "http://localhost:5173";

// ════════════════════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ════════════════════════════════════════════════════════════════════════════

/**
 * HTML template cho email verify.
 *
 * @param {Object} options
 * @param {string} options.userName     - Tên user nhận email
 * @param {string} options.verifyUrl    - Link đầy đủ kèm token
 * @param {number} options.expiresHours - Số giờ token còn hiệu lực
 * @returns {string} HTML content
 *
 * @design Inline CSS (không dùng <style> tag) vì email clients
 *         như Gmail/Outlook strip <style> ra khỏi email.
 */
const buildVerifyEmailHtml = ({ userName, verifyUrl, expiresHours }) => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xác thực email</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color:#4F46E5;padding:30px;text-align:center;border-radius:8px 8px 0 0;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;">🚀 Backend Project</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 30px;">
              <h2 style="color:#333333;margin:0 0 20px 0;">Xin chào ${userName}! 👋</h2>

              <p style="color:#666666;font-size:16px;line-height:1.6;margin:0 0 20px 0;">
                Cảm ơn bạn đã đăng ký tài khoản tại <strong>Backend Project</strong>.
                Để hoàn tất quá trình đăng ký, vui lòng xác thực email bằng cách
                click vào nút dưới đây:
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:30px 0;">
                <tr>
                  <td style="border-radius:6px;background-color:#4F46E5;">
                    <a href="${verifyUrl}"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;">
                      ✅ Xác thực email ngay
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#666666;font-size:14px;line-height:1.6;margin:20px 0 0 0;">
                Hoặc copy link sau vào trình duyệt:
              </p>
              <p style="background-color:#f9f9f9;padding:12px;border-radius:4px;word-break:break-all;font-size:13px;color:#4F46E5;">
                ${verifyUrl}
              </p>

              <div style="border-top:1px solid #eeeeee;margin:30px 0;"></div>

              <p style="color:#999999;font-size:13px;line-height:1.6;margin:0;">
                ⏰ Link xác thực có hiệu lực trong <strong>${expiresHours} giờ</strong>.<br>
                ❓ Nếu bạn không đăng ký tài khoản, vui lòng bỏ qua email này.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9f9f9;padding:20px 30px;text-align:center;border-radius:0 0 8px 8px;">
              <p style="color:#999999;font-size:12px;margin:0;">
                © 2026 Backend Project. Email tự động — vui lòng không reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ════════════════════════════════════════════════════════════════════════════
// EMAIL SENDERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Gửi email verify cho user mới register.
 *
 * @param {Object} payload
 * @param {string} payload.to        - Email người nhận
 * @param {string} payload.userName  - Tên user (hiển thị trong email)
 * @param {string} payload.token     - Verification token
 *
 * @returns {Promise<void>}
 *
 * @throws {Error} Nếu gửi email fail (network/SMTP error).
 *                 Caller (auth.service) sẽ catch và log warning,
 *                 KHÔNG throw lên user — vì user đã register thành công.
 *
 * @design Best-effort delivery: Register flow KHÔNG block bởi email send.
 *         Nếu email fail → user dùng "Resend verification email" để retry.
 */
exports.sendVerificationEmail = async ({ to, userName, token }) => {
  /*
   * Generate verify URL trỏ về FRONTEND.
   *
   * FE nhận token từ query string → call API:
   *   GET /api/auth/verify-email?token=xxx
   *
   * Lý do dùng FE URL thay vì BE URL:
   *   - User click link trong email → mở FE → user thấy UI đẹp
   *   - Nếu click link BE → user thấy raw JSON response, không UX
   */
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

  const mailOptions = {
    from:    `"${FROM_NAME}" <${FROM_ADDRESS}>`,
    to,
    subject: "🔐 Xác thực email tài khoản của bạn",
    html:    buildVerifyEmailHtml({
      userName,
      verifyUrl,
      expiresHours: 24,
    }),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`EMAIL SENT: verify to=${to} messageId=${info.messageId}`);
  } catch (err) {
    logger.error(`EMAIL FAILED: verify to=${to} error=${err.message}`);
    throw err; // Caller quyết định xử lý
  }
};