const express = require("express");
const router = express.Router({ mergeParams: true });
const reviewController = require("../controllers/review.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const checkRole = require("../middlewares/checkRole");

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Review APIs — nested dưới /api/products/:id/reviews
 */

/**
 * @swagger
 * /api/products/{id}/reviews:
 *   get:
 *     summary: Lấy danh sách đánh giá của sản phẩm (cursor-based pagination)
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 10 }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *         description: Timestamp của review cuối — dùng để load thêm
 *     responses:
 *       200:
 *         description: Danh sách reviews kèm avgRating, totalReviews, hasMore, nextCursor
 */
router.get("/", reviewController.getReviews);

/**
 * @swagger
 * /api/products/{id}/reviews:
 *   post:
 *     summary: Đánh giá sản phẩm (cần đã mua và nhận hàng thành công)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               comment:
 *                 type: string
 *                 example: Sản phẩm rất tốt!
 *     responses:
 *       201:
 *         description: Đánh giá thành công
 *       400:
 *         description: Rating không hợp lệ hoặc đã đánh giá rồi
 *       403:
 *         description: Chưa mua sản phẩm này
 */
router.post("/", verifyToken, reviewController.createReview);

/**
 * @swagger
 * /api/products/{id}/reviews/{reviewId}/reply:
 *   patch:
 *     summary: Admin phản hồi đánh giá
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reply]
 *             properties:
 *               reply:
 *                 type: string
 *                 example: Cảm ơn bạn đã đánh giá!
 *     responses:
 *       200:
 *         description: Phản hồi thành công
 *       403:
 *         description: Không phải admin
 *       404:
 *         description: Review không tồn tại
 */
router.patch("/:reviewId/reply", verifyToken, checkRole("admin"), reviewController.replyReview);

/**
 * @swagger
 * /api/products/{id}/reviews/{reviewId}:
 *   delete:
 *     summary: Xóa đánh giá (chủ review hoặc admin)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       403:
 *         description: Không có quyền xóa
 *       404:
 *         description: Review không tồn tại
 */
router.delete("/:reviewId", verifyToken, reviewController.deleteReview);

module.exports = router;