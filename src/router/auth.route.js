const express    = require("express");
const router     = express.Router();
const rateLimit  = require("express-rate-limit");
const authController = require("../controllers/auth.controller");
const validate       = require("../middlewares/validate.middleware");
const { registerSchema, loginSchema } = require("../validations/user.validation");

/*
 * Rate limit riêng cho login: 5 lần / 15 phút / IP.
 * Đặt ở đây thay vì app.js để giữ logic gần với route liên quan.
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
 *                 example: "123456"
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *       409:
 *         description: Email đã tồn tại
 */
router.post("/register", validate(registerSchema), authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập
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
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Login thành công – trả về accessToken + refreshToken
 *       401:
 *         description: Sai email hoặc password
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
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
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
 *     summary: Đăng xuất
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
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 *       400:
 *         description: Token không hợp lệ
 */
router.post("/logout", authController.logout);

module.exports = router;