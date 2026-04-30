const express    = require("express");
const router     = express.Router();
const productController = require("../controllers/product.controller");
const { verifyToken }   = require("../middlewares/auth.middleware");
const checkRole         = require("../middlewares/checkRole");
const { cache }         = require("../middlewares/cache.middleware");

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Product APIs
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Lấy danh sách sản phẩm (có filter + pagination + Redis cache 5 phút)
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, example: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string, example: iPhone 15 }
 *       - in: query
 *         name: category
 *         schema: { type: string, example: phone }
 *       - in: query
 *         name: brand
 *         schema: { type: string, example: "Apple,Samsung" }
 *         description: Nhiều brand cách nhau bằng dấu phẩy
 *       - in: query
 *         name: minPrice
 *         schema: { type: number, example: 5000000 }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number, example: 30000000 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, draft, outofstock] }
 *     responses:
 *       200:
 *         description: Danh sách sản phẩm kèm meta pagination
 */
router.get(
  "/",
  cache(),
  productController.getProducts
);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Chi tiết sản phẩm kèm specs (Redis cache 10 phút)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: Chi tiết sản phẩm
 *       404:
 *         description: Sản phẩm không tồn tại
 */
router.get(
  "/:id",
  cache(60 * 10),
  productController.getProductById
);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Thêm sản phẩm mới (Admin)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [brand, title, price, category]
 *             properties:
 *               brand:    { type: string, example: Apple }
 *               title:    { type: string, example: iPhone 16 Pro Max }
 *               price:    { type: number, example: 33990000 }
 *               oldPrice: { type: number, example: 35990000 }
 *               discount: { type: integer, example: 5 }
 *               category: { type: string, example: phone }
 *               stock:    { type: integer, example: 50 }
 *               status:   { type: string, enum: [active, draft, outofstock] }
 *     responses:
 *       201:
 *         description: Thêm thành công
 *       400:
 *         description: Thiếu thông tin bắt buộc
 *       403:
 *         description: Không có quyền admin
 */
router.post(
  "/",
  verifyToken,
  checkRole("admin"),
  productController.createProduct
);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Cập nhật sản phẩm (Admin)
 *     tags: [Products]
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
 *             properties:
 *               title:  { type: string }
 *               price:  { type: number }
 *               stock:  { type: integer }
 *               status: { type: string, enum: [active, draft, outofstock] }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         description: Sản phẩm không tồn tại
 */
router.put(
  "/:id",
  verifyToken,
  checkRole("admin"),
  productController.updateProduct
);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Xóa sản phẩm (Admin)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       404:
 *         description: Sản phẩm không tồn tại
 */
router.delete(
  "/:id",
  verifyToken,
  checkRole("admin"),
  productController.deleteProduct
);

module.exports = router;