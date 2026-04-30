const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const checkRole = require("../middlewares/checkRole");
const validate = require("../middlewares/validate.middleware");
const { createOrderSchema } = require("../validations/user.validation");

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order APIs – cần Bearer Token
 */

//  Admin xem tất cả orders – PHẢI đặt trước /:id
router.get("/", verifyToken, checkRole("admin"), orderController.getAllOrders);

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Tạo đơn hàng
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: integer
 *                       example: 1
 *                     quantity:
 *                       type: integer
 *                       example: 2
 *               shippingInfo:
 *                 type: object
 *                 properties:
 *                   name:    { type: string, example: "Nguyen Van A" }
 *                   phone:   { type: string, example: "0909123456" }
 *                   email:   { type: string, example: "a@gmail.com" }
 *                   address: { type: string, example: "123 Nguyen Hue" }
 *               payMethod:
 *                 type: string
 *                 enum: [cod, banking, momo]
 *                 example: cod
 *     responses:
 *       201:
 *         description: Tạo đơn thành công
 *       400:
 *         description: Validation error
 *       404:
 *         description: Product không tồn tại
 */
//  Thêm validate(createOrderSchema) — sanitize XSS + validate input trước controller
router.post("/", verifyToken, validate(createOrderSchema), orderController.createOrder);

/**
 * @swagger
 * /api/orders/me:
 *   get:
 *     summary: Xem đơn hàng của mình
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách đơn hàng của user hiện tại
 *       401:
 *         description: Chưa đăng nhập
 */
router.get("/me", verifyToken, orderController.getMyOrders);

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Chi tiết đơn hàng
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: Chi tiết đơn hàng
 *       403:
 *         description: Không có quyền xem đơn này
 *       404:
 *         description: Không tìm thấy đơn hàng
 */
router.get("/:id", verifyToken, orderController.getOrderById);

/**
 * @swagger
 * /api/orders/{id}/cancel:
 *   patch:
 *     summary: Huỷ đơn hàng
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: Huỷ đơn thành công
 *       400:
 *         description: Không thể huỷ đơn đã completed hoặc đã cancelled
 *       403:
 *         description: Không có quyền huỷ đơn này
 *       404:
 *         description: Không tìm thấy đơn hàng
 */
router.patch("/:id/cancel", verifyToken, orderController.cancelOrder);



//  Admin cập nhật status đơn hàng
router.patch("/:id/status", verifyToken, checkRole("admin"), orderController.updateOrderStatus);

module.exports = router;