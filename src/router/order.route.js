




const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const checkRole = require("../middlewares/checkRole"); // ✅ thêm

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order APIs – cần Bearer Token
 */

// ✅ Admin xem tất cả orders – PHẢI đặt trước /:id
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
 *     responses:
 *       201:
 *         description: Tạo đơn thành công
 *       400:
 *         description: Items rỗng
 *       404:
 *         description: Product không tồn tại
 */
router.post("/", verifyToken, orderController.createOrder);

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
 *         description: ID đơn hàng
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
 *         description: ID đơn hàng cần huỷ
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


// ✅ Admin cập nhật status đơn hàng
router.patch("/:id/status", verifyToken, checkRole("admin"), orderController.updateOrderStatus);

module.exports = router;