const express    = require("express");
const router     = express.Router();
const { Op }     = require("sequelize");
const sequelize  = require("../config/db");
const { Product, ProductSpec } = require("../models/index");
const { sendResponse }    = require("../utils/response");
const AppError            = require("../utils/AppError");
const catchAsync          = require("../utils/catchAsync");
const { verifyToken }     = require("../middlewares/auth.middleware");
const checkRole           = require("../middlewares/checkRole");
const { cache, clearCache } = require("../middlewares/cache.middleware");

const parseArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return val.split(",").map(s => s.trim()).filter(Boolean);
};

const VALID_STATUSES = ["active", "draft", "outofstock"];

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
router.get("/", cache(), catchAsync(async (req, res, next) => {
  const page   = parseInt(req.query.page)  || 1;
  const limit  = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const {
    search, brand, category,
    minPrice, maxPrice,
    ram, rom, chip, camera, battery, display,
    status,
  } = req.query;

  const where = {};

  // ─── Smart Search ──────────────────────────────────────────────────────
  // Chiến lược: tách keyword thành từng từ, mỗi từ phải xuất hiện trong title
  //
  // Ví dụ: "iphone 15"
  //   → words = ["iphone", "15"]
  //   → WHERE title LIKE '%iphone%' AND title LIKE '%15%'
  //   → Chỉ ra sản phẩm có cả "iphone" VÀ "15" → chính xác ✅
  //
  // Ví dụ: "iphon 15"
  //   → words = ["iphon", "15"]
  //   → WHERE title LIKE '%iphon%' AND title LIKE '%15%'
  //   → "iPhone 15 Pro" có "iphone" chứa "iphon" → match ✅
  //   → "Xiaomi 15T" không có "iphon" → không match ✅
  //
  // Tại sao không dùng FULLTEXT?
  //   FULLTEXT tìm theo từ nguyên — "iphone" và "15" là 2 từ riêng
  //   → match tất cả sản phẩm có "iphone" HOẶC "15" → không chính xác
  //   LIKE '%keyword%' tìm substring → "iphon" nằm trong "iphone" → match
  // ──────────────────────────────────────────────────────────────────────
  if (search && search.trim()) {
    const words = search.trim().split(/\s+/).filter(Boolean);

    if (words.length === 1) {
      // 1 từ → LIKE đơn giản
      where.title = { [Op.like]: `%${words[0]}%` };
    } else {
      // Nhiều từ → mỗi từ phải có trong title (AND)
      where[Op.and] = words.map(word => ({
        title: { [Op.like]: `%${word}%` }
      }));
    }
  }
  // ──────────────────────────────────────────────────────────────────────

  if (category) where.category = category;

  const brands = parseArray(brand);
  if (brands.length === 1) where.brand = brands[0];
  if (brands.length  > 1) where.brand = { [Op.in]: brands };

  if (minPrice !== undefined && minPrice !== "") {
    where.price = { ...where.price, [Op.gte]: parseFloat(minPrice) };
  }
  if (maxPrice !== undefined && maxPrice !== "") {
    where.price = { ...where.price, [Op.lte]: parseFloat(maxPrice) };
  }

  const addSpecFilter = (field, rawVal) => {
    const vals = parseArray(rawVal);
    if (!vals.length) return;
    if (vals.length === 1) {
      where[field] = { [Op.like]: `%${vals[0]}%` };
    } else {
      where[field] = { [Op.or]: vals.map(v => ({ [Op.like]: `%${v}%` })) };
    }
  };

  addSpecFilter("ram",     ram);
  addSpecFilter("rom",     rom);
  addSpecFilter("chip",    chip);
  addSpecFilter("camera",  camera);
  addSpecFilter("battery", battery);
  addSpecFilter("display", display);

  if (status && VALID_STATUSES.includes(status)) {
    where.status = status;
  }

  const { count, rows } = await Product.findAndCountAll({
    where,
    limit,
    offset,
    order: [["createdAt", "DESC"]],
  });

  return sendResponse(res, 200, "success", "OK", {
    data: rows,
    meta: {
      total:      count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  });
}));

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
router.get("/:id", cache(60 * 10), catchAsync(async (req, res, next) => {
  const product = await Product.findByPk(req.params.id, {
    include: [{
      model: ProductSpec,
      as: "specs",
      attributes: ["specKey", "specValue", "sortOrder"],
      order: [["sortOrder", "ASC"]],
    }],
  });

  if (!product) return next(new AppError("Product not found", 404));

  return sendResponse(res, 200, "success", "OK", product);
}));

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
router.post("/", verifyToken, checkRole("admin"), catchAsync(async (req, res, next) => {
  const {
    brand, title, img, discount, price, oldPrice,
    category, nation, display, screenTech, ram, rom,
    chip, camera, battery, charging, description, stock, sold,
    status,
  } = req.body;

  if (!brand || !title || !price || !category) {
    return next(new AppError("Thiếu thông tin bắt buộc: brand, title, price, category", 400));
  }

  const productStatus = VALID_STATUSES.includes(status) ? status : "active";

  const product = await Product.create({
    brand, title, img, discount, price, oldPrice,
    category, nation, display, screenTech, ram, rom,
    chip, camera, battery, charging, description,
    stock: stock || 50,
    sold:  sold  || 0,
    status: productStatus,
  });

  const specsData = buildSpecs({ display, screenTech, ram, rom, chip, camera, battery, charging, nation });
  if (specsData.length > 0) {
    await ProductSpec.bulkCreate(specsData.map(s => ({ ...s, productId: product.id })));
  }

  await clearCache("/api/products");
  return sendResponse(res, 201, "success", "Thêm sản phẩm thành công!", product);
}));

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
 *               title:    { type: string }
 *               price:    { type: number }
 *               stock:    { type: integer }
 *               status:   { type: string, enum: [active, draft, outofstock] }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         description: Sản phẩm không tồn tại
 */
router.put("/:id", verifyToken, checkRole("admin"), catchAsync(async (req, res, next) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return next(new AppError("Product not found", 404));

  const {
    brand, title, img, discount, price, oldPrice,
    category, nation, display, screenTech, ram, rom,
    chip, camera, battery, charging, description, stock, sold,
    status,
  } = req.body;

  await product.update({
    brand, title, img, discount, price, oldPrice,
    category, nation, display, screenTech, ram, rom,
    chip, camera, battery, charging, description, stock, sold,
    ...(VALID_STATUSES.includes(status) && { status }),
  });

  await ProductSpec.destroy({ where: { productId: product.id } });
  const specsData = buildSpecs({ display, screenTech, ram, rom, chip, camera, battery, charging, nation });
  if (specsData.length > 0) {
    await ProductSpec.bulkCreate(specsData.map(s => ({ ...s, productId: product.id })));
  }

  await clearCache("/api/products");
  return sendResponse(res, 200, "success", "Cập nhật sản phẩm thành công!", product);
}));

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
router.delete("/:id", verifyToken, checkRole("admin"), catchAsync(async (req, res, next) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return next(new AppError("Product not found", 404));

  await ProductSpec.destroy({ where: { productId: product.id } });
  await product.destroy();

  await clearCache("/api/products");
  return sendResponse(res, 200, "success", "Xóa sản phẩm thành công!");
}));

const buildSpecs = ({ display, screenTech, ram, rom, chip, camera, battery, charging, nation }) =>
  [
    { specKey: "display",    specValue: display,    sortOrder: 1 },
    { specKey: "screenTech", specValue: screenTech, sortOrder: 2 },
    { specKey: "ram",        specValue: ram,        sortOrder: 3 },
    { specKey: "rom",        specValue: rom,        sortOrder: 4 },
    { specKey: "chip",       specValue: chip,       sortOrder: 5 },
    { specKey: "camera",     specValue: camera,     sortOrder: 6 },
    { specKey: "battery",    specValue: battery,    sortOrder: 7 },
    { specKey: "charging",   specValue: charging,   sortOrder: 8 },
    { specKey: "nation",     specValue: nation,     sortOrder: 9 },
  ].filter(s => s.specValue);

module.exports = router;