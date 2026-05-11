/**
 * ════════════════════════════════════════════════════════════════════════════
 * APPLICATION-WIDE CONSTANTS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Centralized constants để tránh duplicate giữa các services.
 * Khi cần đổi giá trị → chỉ đổi 1 chỗ duy nhất.
 *
 * Convention: Đặt theo từng domain (AUTH, SESSION, EMAIL, v.v.)
 * ════════════════════════════════════════════════════════════════════════════
 */

// ════════════════════════════════════════════════════════════════════════════
// AUTH & SECURITY
// ════════════════════════════════════════════════════════════════════════════

/**
 * Bcrypt cost factor (salt rounds).
 *
 * Benchmark trên CPU server tiêu chuẩn (Intel Xeon 2.4GHz):
 *   - 10: ~60ms/hash   → YẾU cho 2026
 *   - 12: ~250ms/hash  → CHUẨN industry hiện tại ✅
 *   - 14: ~1000ms/hash → CHẬM, dùng cho admin/banking
 *
 * @security OWASP Password Storage Cheat Sheet 2024 khuyến nghị tối thiểu 10,
 *           production nên dùng 12.
 */
const BCRYPT_SALT_ROUNDS = 12;

/**
 * JWT token expiry.
 */
const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_IN = "7d";

/**
 * Account Lockout — số lần login sai password tối đa cho phép.
 *
 * Industry standard:
 *   - GitHub: 10 lần / IP
 *   - Google: ~5 lần / account
 *   - Microsoft: 10 lần / account
 *
 * Chọn 5 lần — cân bằng UX (user gõ sai vài lần OK) và security
 * (chống brute-force hiệu quả).
 */
const MAX_LOGIN_ATTEMPTS = 5;

/**
 * Account Lockout — thời gian khoá tài khoản sau khi đạt MAX_LOGIN_ATTEMPTS.
 *
 * Cố định 15 phút (không progressive lockout):
 *   - Đủ lâu để chặn brute-force tự động
 *   - Đủ ngắn để user thật không quá khó chịu
 *   - Đơn giản, dễ giải thích phỏng vấn
 */
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 phút

// ════════════════════════════════════════════════════════════════════════════
// EMAIL VERIFICATION & PASSWORD RESET
// ════════════════════════════════════════════════════════════════════════════

/**
 * Verification token expiry — 24 giờ.
 *
 * Tradeoff:
 *   - Quá ngắn (1h): User check mail muộn → phải resend
 *   - Quá dài (7d): Risk security nếu email bị steal
 *   - 24h: Cân bằng giữa UX và security ✅
 */
const VERIFICATION_TOKEN_EXPIRES_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Password reset token expiry — 1 GIỜ.
 *
 * Sensitive hơn verify nên expire nhanh hơn:
 *   - Email leak → attacker chỉ có 1h để dùng
 *   - User thường reset ngay khi nhận email
 *   - OWASP recommendation: 15-60 phút cho password reset
 */
const PASSWORD_RESET_TOKEN_EXPIRES_MS = 60 * 60 * 1000; // 1h

// ════════════════════════════════════════════════════════════════════════════
// REDIS / SESSION
// ════════════════════════════════════════════════════════════════════════════

/**
 * Refresh token TTL trong Redis — 7 ngày, trùng với REFRESH_TOKEN_EXPIRES_IN.
 * Key tự xóa khi token hết hạn → không cần cleanup thủ công.
 */
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 ngày

// ════════════════════════════════════════════════════════════════════════════
// PAGINATION
// ════════════════════════════════════════════════════════════════════════════

/**
 * Cap pagination limit để tránh client dump toàn bộ bảng trong 1 request.
 */
const MAX_PAGE_LIMIT = 50;

// ════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Auth & Security
  BCRYPT_SALT_ROUNDS,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MS,

  // Email verification & password reset
  VERIFICATION_TOKEN_EXPIRES_MS,
  PASSWORD_RESET_TOKEN_EXPIRES_MS,

  // Redis / session
  REFRESH_TOKEN_TTL_SECONDS,

  // Pagination
  MAX_PAGE_LIMIT,
};
