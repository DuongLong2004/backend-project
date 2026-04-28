const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/wishlist.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * tags:
 *   name: Wishlist
 *   description: Wishlist APIs — cần đăng nhập
 */

/**
 * @swagger
 * /api/wishlist:
 *   get:
 *     summary: Lấy danh sách yêu thích của user
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách sản phẩm yêu thích
 *       401:
 *         description: Chưa đăng nhập
 */
router.get("/", verifyToken, ctrl.getWishlist);

/**
 * @swagger
 * /api/wishlist/ids:
 *   get:
 *     summary: Lấy danh sách productId đã thích (dùng để check nhanh trên UI)
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mảng productId
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { type: integer }
 *                   example: [1, 3, 7]
 */
router.get("/ids", verifyToken, ctrl.getWishlistIds);

/**
 * @swagger
 * /api/wishlist/{productId}:
 *   post:
 *     summary: Thêm sản phẩm vào danh sách yêu thích
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       201:
 *         description: Thêm thành công
 *       400:
 *         description: Sản phẩm đã có trong danh sách yêu thích
 *       404:
 *         description: Sản phẩm không tồn tại
 */
router.post("/:productId", verifyToken, ctrl.addWishlist);

/**
 * @swagger
 * /api/wishlist/{productId}:
 *   delete:
 *     summary: Xóa sản phẩm khỏi danh sách yêu thích
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       404:
 *         description: Không tìm thấy trong danh sách yêu thích
 */
router.delete("/:productId", verifyToken, ctrl.removeWishlist);

module.exports = router;