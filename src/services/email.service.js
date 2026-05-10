const { sendEmail } = require("../config/email");
const logger        = require("../utils/logger");

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Frontend URL — base URL để generate verify/reset link.
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

/**
 * HTML template cho email reset password.
 */
const buildResetPasswordEmailHtml = ({ userName, resetUrl, expiresMinutes }) => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đặt lại mật khẩu</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color:#DC2626;padding:30px;text-align:center;border-radius:8px 8px 0 0;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;">🔐 Đặt lại mật khẩu</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 30px;">
              <h2 style="color:#333333;margin:0 0 20px 0;">Xin chào ${userName}! 👋</h2>

              <p style="color:#666666;font-size:16px;line-height:1.6;margin:0 0 20px 0;">
                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại
                <strong>Backend Project</strong>. Click vào nút dưới đây để tạo mật khẩu mới:
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:30px 0;">
                <tr>
                  <td style="border-radius:6px;background-color:#DC2626;">
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;">
                      🔑 Đặt lại mật khẩu ngay
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#666666;font-size:14px;line-height:1.6;margin:20px 0 0 0;">
                Hoặc copy link sau vào trình duyệt:
              </p>
              <p style="background-color:#f9f9f9;padding:12px;border-radius:4px;word-break:break-all;font-size:13px;color:#DC2626;">
                ${resetUrl}
              </p>

              <div style="border-top:1px solid #eeeeee;margin:30px 0;"></div>

              <!-- Warning box -->
              <div style="background-color:#FEF2F2;border-left:4px solid #DC2626;padding:16px;border-radius:4px;margin:20px 0;">
                <p style="color:#991B1B;font-size:13px;line-height:1.6;margin:0;">
                  ⚠️ <strong>Lưu ý bảo mật:</strong><br>
                  • Link đặt lại mật khẩu chỉ có hiệu lực trong <strong>${expiresMinutes} phút</strong>.<br>
                  • Sau khi đặt lại, tất cả phiên đăng nhập trên các thiết bị khác sẽ bị đăng xuất.<br>
                  • Nếu bạn KHÔNG yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này
                  và đổi mật khẩu ngay nếu nghi ngờ tài khoản bị xâm nhập.
                </p>
              </div>
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

/**
 * HTML template cho email cảnh báo account locked.
 */
const buildAccountLockedEmailHtml = ({ userName, unlockTimeStr, maxAttempts, lockoutMinutes }) => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cảnh báo bảo mật</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color:#F59E0B;padding:30px;text-align:center;border-radius:8px 8px 0 0;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;">⚠️ Cảnh báo bảo mật</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 30px;">
              <h2 style="color:#333333;margin:0 0 20px 0;">Xin chào ${userName}! 👋</h2>

              <p style="color:#666666;font-size:16px;line-height:1.6;margin:0 0 20px 0;">
                Chúng tôi vừa phát hiện <strong>${maxAttempts} lần đăng nhập thất bại liên tiếp</strong>
                vào tài khoản của bạn tại <strong>Backend Project</strong>.
              </p>

              <p style="color:#666666;font-size:16px;line-height:1.6;margin:0 0 20px 0;">
                Để bảo vệ tài khoản, chúng tôi đã <strong style="color:#DC2626;">tạm khoá đăng nhập</strong>
                trong vòng <strong>${lockoutMinutes} phút</strong>.
              </p>

              <!-- Unlock time box -->
              <div style="background-color:#FEF3C7;border-left:4px solid #F59E0B;padding:16px;border-radius:4px;margin:25px 0;">
                <p style="color:#92400E;font-size:14px;margin:0 0 8px 0;font-weight:bold;">
                  🕐 Tài khoản sẽ tự động mở khoá lúc:
                </p>
                <p style="color:#78350F;font-size:18px;margin:0;font-weight:bold;">
                  ${unlockTimeStr}
                </p>
              </div>

              <!-- Warning box -->
              <div style="background-color:#FEF2F2;border-left:4px solid #DC2626;padding:16px;border-radius:4px;margin:25px 0;">
                <p style="color:#991B1B;font-size:14px;line-height:1.6;margin:0;">
                  🚨 <strong>Nếu KHÔNG phải bạn thực hiện:</strong><br>
                  • Có thể tài khoản đang bị tấn công brute-force<br>
                  • Sau khi mở khoá, hãy đổi mật khẩu ngay lập tức<br>
                  • Kiểm tra các phiên đăng nhập đang hoạt động và đăng xuất các phiên lạ
                </p>
              </div>

              <p style="color:#666666;font-size:14px;line-height:1.6;margin:20px 0 0 0;">
                ✅ Nếu chính bạn quên mật khẩu, vui lòng dùng chức năng
                <strong>"Quên mật khẩu"</strong> để đặt lại sau khi tài khoản được mở khoá.
              </p>

              <div style="border-top:1px solid #eeeeee;margin:30px 0;"></div>

              <p style="color:#999999;font-size:13px;line-height:1.6;margin:0;">
                Email này được gửi tự động khi hệ thống phát hiện hoạt động đáng ngờ.
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
// EMAIL SENDERS — dùng sendEmail() unified (auto pick Resend/Nodemailer)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Gửi email verify cho user mới register.
 *
 * @param {Object} payload
 * @param {string} payload.to        - Email người nhận
 * @param {string} payload.userName  - Tên user (hiển thị trong email)
 * @param {string} payload.token     - Verification token
 *
 * @design Best-effort delivery: Register flow KHÔNG block bởi email send.
 *         Nếu email fail → user dùng "Resend verification email" để retry.
 */
exports.sendVerificationEmail = async ({ to, userName, token }) => {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

  try {
    const { messageId } = await sendEmail({
      to,
      subject: "🔐 Xác thực email tài khoản của bạn",
      html: buildVerifyEmailHtml({
        userName,
        verifyUrl,
        expiresHours: 24,
      }),
    });
    logger.info(`EMAIL SENT: verify to=${to} messageId=${messageId}`);
  } catch (err) {
    logger.error(`EMAIL FAILED: verify to=${to} error=${err.message}`);
    throw err;
  }
};

/**
 * Gửi email reset password.
 */
exports.sendPasswordResetEmail = async ({ to, userName, token }) => {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

  try {
    const { messageId } = await sendEmail({
      to,
      subject: "🔐 Yêu cầu đặt lại mật khẩu",
      html: buildResetPasswordEmailHtml({
        userName,
        resetUrl,
        expiresMinutes: 60,
      }),
    });
    logger.info(`EMAIL SENT: reset-password to=${to} messageId=${messageId}`);
  } catch (err) {
    logger.error(`EMAIL FAILED: reset-password to=${to} error=${err.message}`);
    throw err;
  }
};

/**
 * Gửi email cảnh báo tài khoản bị khoá do đăng nhập sai nhiều lần (Phần 8).
 */
exports.sendAccountLockedEmail = async ({
  to,
  userName,
  unlockTime,
  maxAttempts = 5,
  lockoutMinutes = 15,
}) => {
  // Format unlock time theo timezone Việt Nam
  const unlockTimeStr = unlockTime.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour:     "2-digit",
    minute:   "2-digit",
    day:      "2-digit",
    month:    "2-digit",
    year:     "numeric",
  });

  try {
    const { messageId } = await sendEmail({
      to,
      subject: "⚠️ Cảnh báo: Tài khoản của bạn vừa bị tạm khoá",
      html: buildAccountLockedEmailHtml({
        userName,
        unlockTimeStr,
        maxAttempts,
        lockoutMinutes,
      }),
    });
    logger.info(`EMAIL SENT: account-locked to=${to} messageId=${messageId}`);
  } catch (err) {
    logger.error(`EMAIL FAILED: account-locked to=${to} error=${err.message}`);
    throw err;
  }
};