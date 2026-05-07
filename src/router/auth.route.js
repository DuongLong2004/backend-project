const express    = require("express");
const router     = express.Router();
const rateLimit  = require("express-rate-limit");
const authController = require("../controllers/auth.controller");
const sessionController = require("../controllers/session.controller");
const validate       = require("../middlewares/validate.middleware");
const { verifyToken } = require("../middlewares/auth.middleware");
const {
  registerSchema,
  loginSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} = require("../validations/user.validation");

// ════════════════════════════════════════════════════════════════════════════
// RATE LIMITERS
// ════════════════════════════════════════════════════════════════════════════

const isTest = process.env.NODE_ENV === "test";
const noopLimiter = (req, res, next) => next();

const loginLimiter = isTest
  ? noopLimiter
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max:      5,
      message:  {
        status:  "error",
        message: "Too many login attempts, please try again after 15 minutes",
        data:    null,
      },
    });

const resendVerificationLimiter = isTest
  ? noopLimiter
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max:      3,
      message:  {
        status:  "error",
        message: "Bạn đã yêu cầu gửi lại email quá nhiều lần. Vui lòng thử lại sau 15 phút.",
        data:    null,
      },
    });

const forgotPasswordLimiter = isTest
  ? noopLimiter
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max:      3,
      message:  {
        status:  "error",
        message: "Bạn đã yêu cầu đặt lại mật khẩu quá nhiều lần. Vui lòng thử lại sau 15 phút.",
        data:    null,
      },
    });

const resetPasswordLimiter = isTest
  ? noopLimiter
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max:      5,
      message:  {
        status:  "error",
        message: "Quá nhiều lần thử. Vui lòng thử lại sau 15 phút.",
        data:    null,
      },
    });

/**
 * Rate limit cho change password: 10 lần / 15 phút / IP.
 *
 * Looser hơn login vì:
 *   - User đã authenticated (có JWT) → đã pass 1 lớp bảo mật
 *   - User legit có thể nhập sai currentPassword vài lần (quên mật khẩu)
 *   - 10 lần đủ chặn brute force tự động
 */
const changePasswordLimiter = isTest
  ? noopLimiter
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max:      10,
      message:  {
        status:  "error",
        message: "Quá nhiều lần thử đổi mật khẩu. Vui lòng thử lại sau 15 phút.",
        data:    null,
      },
    });

// ════════════════════════════════════════════════════════════════════════════
// SWAGGER + ROUTES
// ════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication APIs
 */

router.post("/register", validate(registerSchema), authController.register);
router.post("/login", loginLimiter, validate(loginSchema), authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);

router.get("/verify-email", authController.verifyEmail);

router.post(
  "/resend-verification",
  resendVerificationLimiter,
  validate(resendVerificationSchema),
  authController.resendVerification
);

router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

router.post(
  "/reset-password",
  resetPasswordLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword
);

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Đổi mật khẩu (cần authenticated)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: "OldPass1234"
 *               newPassword:
 *                 type: string
 *                 example: "NewPass1234"
 *     responses:
 *       200:
 *         description: |
 *           Đổi mật khẩu thành công. Response trả về accessToken + refreshToken MỚI,
 *           FE phải update localStorage để giữ session.
 *       400:
 *         description: Mật khẩu mới trùng mật khẩu cũ hoặc không đúng định dạng
 *       401:
 *         description: Mật khẩu hiện tại không đúng
 *       429:
 *         description: Quá nhiều lần thử
 */
router.post(
  "/change-password",
  changePasswordLimiter,
  verifyToken,
  validate(changePasswordSchema),
  authController.changePassword
);


// ════════════════════════════════════════════════════════════════════════════
// SESSION MANAGEMENT (Phần 5 — Multi-device)
// ════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /api/auth/sessions:
 *   get:
 *     summary: Lấy danh sách thiết bị đang đăng nhập
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách sessions kèm flag isCurrent cho device hiện tại
 */
router.get("/sessions", verifyToken, sessionController.listSessions);

/**
 * @swagger
 * /api/auth/sessions:
 *   delete:
 *     summary: Đăng xuất khỏi tất cả thiết bị KHÁC (giữ thiết bị hiện tại)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.delete("/sessions", verifyToken, sessionController.revokeOtherSessions);

/**
 * @swagger
 * /api/auth/sessions/{deviceId}:
 *   delete:
 *     summary: Đăng xuất 1 thiết bị cụ thể (không được phép logout self)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Đã đăng xuất thiết bị thành công }
 *       400: { description: Không thể logout self qua endpoint này }
 */
router.delete("/sessions/:deviceId", verifyToken, sessionController.revokeSession);

module.exports = router;