const express    = require("express");
const router     = express.Router();
const rateLimit  = require("express-rate-limit");
const authController = require("../controllers/auth.controller");
const validate       = require("../middlewares/validate.middleware");
const {
  registerSchema,
  loginSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../validations/user.validation");

// ════════════════════════════════════════════════════════════════════════════
// RATE LIMITERS
// ════════════════════════════════════════════════════════════════════════════

/*
 * Test environment: skip rate limiter để tránh test bị "dính" 429
 * khi test sau gửi nhiều request liên tiếp đến cùng endpoint.
 *
 * Production và development: rate limiter chạy bình thường.
 */
const isTest = process.env.NODE_ENV === "test";

const noopLimiter = (req, res, next) => next();

/**
 * Rate limit cho login: 5 lần / 15 phút / IP.
 * Chống brute force attack.
 */
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

/**
 * Rate limit cho resend verification: 3 lần / 15 phút / IP.
 *
 * Lý do strict hơn login:
 *   - Mỗi resend = 1 email gửi → Gmail free tier 500/day
 *   - Chống spam attacker dùng để spam email user khác
 */
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

/**
 * Rate limit cho forgot password: 3 lần / 15 phút / IP.
 *
 * Strict vì:
 *   - Mỗi request = 1 email gửi → tránh quota Gmail
 *   - Chống attacker spam email user khác
 *   - Chống enumeration attack tốc độ cao
 */
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

/**
 * Rate limit cho reset password: 5 lần / 15 phút / IP.
 *
 * Lý do tách riêng:
 *   - Endpoint này không gửi email, chỉ verify token
 *   - User legit có thể nhập sai password mới (yêu cầu confirm)
 *   - Vẫn cần limit để chống brute force token
 */
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

// ════════════════════════════════════════════════════════════════════════════
// SWAGGER DOCS
// ════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication APIs
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Đăng ký tài khoản
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Duong Long
 *               email:
 *                 type: string
 *                 example: duonglong@gmail.com
 *               password:
 *                 type: string
 *                 example: "Test1234"
 *     responses:
 *       201:
 *         description: Đăng ký thành công, email verify đã được gửi
 *       409:
 *         description: Email đã tồn tại
 */
router.post("/register", validate(registerSchema), authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập (yêu cầu đã verify email)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: duonglong@gmail.com
 *               password:
 *                 type: string
 *                 example: "Test1234"
 *     responses:
 *       200:
 *         description: Login thành công – trả về accessToken + refreshToken
 *       401:
 *         description: Sai email hoặc password
 *       403:
 *         description: Email chưa được xác thực
 *       429:
 *         description: Quá nhiều lần thử, vui lòng thử lại sau 15 phút
 */
router.post("/login", loginLimiter, validate(loginSchema), authController.login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 */
router.post("/refresh", authController.refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Đăng xuất (idempotent — luôn trả 200)
 *     tags: [Auth]
 */
router.post("/logout", authController.logout);

/**
 * @swagger
 * /api/auth/verify-email:
 *   get:
 *     summary: Xác thực email từ link trong email
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: format
 *         required: false
 *         schema: { type: string, enum: [json] }
 *     responses:
 *       200: { description: Verify thành công (JSON mode) }
 *       302: { description: Redirect về FE success/error page }
 *       400: { description: Token invalid hoặc hết hạn (JSON mode) }
 */
router.get("/verify-email", authController.verifyEmail);

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Gửi lại email xác thực
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, example: duonglong@gmail.com }
 *     responses:
 *       200: { description: Email đã gửi (hoặc email không tồn tại — luôn 200) }
 *       400: { description: Email đã được xác thực rồi }
 *       429: { description: Quá nhiều yêu cầu }
 */
router.post(
  "/resend-verification",
  resendVerificationLimiter,
  validate(resendVerificationSchema),
  authController.resendVerification
);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Yêu cầu đặt lại mật khẩu (gửi email reset link)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, example: duonglong@gmail.com }
 *     responses:
 *       200:
 *         description: Email reset đã gửi (hoặc email không tồn tại — luôn 200)
 *       429:
 *         description: Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút
 */
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Đặt lại mật khẩu mới với token từ email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:
 *                 type: string
 *                 example: a1b2c3d4e5f6...
 *               newPassword:
 *                 type: string
 *                 example: NewPass1234
 *     responses:
 *       200:
 *         description: Đặt lại mật khẩu thành công, all sessions revoked
 *       400:
 *         description: Token invalid/expired hoặc password không hợp lệ
 *       429:
 *         description: Quá nhiều lần thử
 */
router.post(
  "/reset-password",
  resetPasswordLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword
);

module.exports = router;