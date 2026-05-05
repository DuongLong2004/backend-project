const express    = require("express");
const router     = express.Router();
const rateLimit  = require("express-rate-limit");
const authController = require("../controllers/auth.controller");
const validate       = require("../middlewares/validate.middleware");
const { registerSchema, loginSchema } = require("../validations/user.validation");

// ════════════════════════════════════════════════════════════════════════════
// RATE LIMITERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Rate limit cho login: 5 lần / 15 phút / IP.
 * Chống brute force attack.
 */
const loginLimiter = rateLimit({
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
 *   - User legitimate chỉ cần resend 1-2 lần là đủ
 */
const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      3,
  message:  {
    status:  "error",
    message: "Bạn đã yêu cầu gửi lại email quá nhiều lần. Vui lòng thử lại sau 15 phút.",
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Trả về accessToken + refreshToken mới
 *       401:
 *         description: Token không hợp lệ hoặc đã bị revoke
 */
router.post("/refresh", authController.refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Đăng xuất (idempotent — luôn trả 200)
 *     tags: [Auth]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
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
 *         schema:
 *           type: string
 *       - in: query
 *         name: format
 *         required: false
 *         schema:
 *           type: string
 *           enum: [json]
 *         description: "Truyền 'json' để nhận JSON response thay vì redirect"
 *     responses:
 *       200:
 *         description: Verify thành công (JSON mode)
 *       302:
 *         description: Redirect về FE success/error page
 *       400:
 *         description: Token invalid hoặc hết hạn (JSON mode)
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
 *               email:
 *                 type: string
 *                 example: duonglong@gmail.com
 *     responses:
 *       200:
 *         description: Email đã gửi (hoặc email không tồn tại — luôn 200)
 *       400:
 *         description: Email đã được xác thực rồi
 *       429:
 *         description: Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút
 */
router.post(
  "/resend-verification",
  resendVerificationLimiter,
  authController.resendVerification
);

module.exports = router;