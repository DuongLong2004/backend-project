


const express    = require("express");
const router     = express.Router();
const { Op }     = require("sequelize");
const { Product, ProductSpec } = require("../models/index");
const { sendResponse }  = require("../utils/response");
const AppError          = require("../utils/AppError");
const catchAsync        = require("../utils/catchAsync");
const { verifyToken }   = require("../middlewares/auth.middleware");
const checkRole         = require("../middlewares/checkRole");

// ─────────────────────────────────────────────
// Helper: parse comma-separated string → array
// ─────────────────────────────────────────────
const parseArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return val.split(",").map(s => s.trim()).filter(Boolean);
};

// ─────────────────────────────────────────────
// ✅ THÊM MỚI: danh sách status hợp lệ
// Dùng chung ở GET, POST, PUT — tránh lặp code
// ─────────────────────────────────────────────
const VALID_STATUSES = ["active", "draft", "outofstock"];

// ─────────────────────────────────────────────
// GET /api/products
// ─────────────────────────────────────────────
router.get("/", catchAsync(async (req, res, next) => {
  const page   = parseInt(req.query.page)  || 1;
  const limit  = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const {
    search, brand, category,
    minPrice, maxPrice,
    ram, rom, chip, camera, battery, display,
    // ✅ THÊM MỚI: nhận thêm param status từ query string
    // ListProduct gọi: GET /products?status=active  → chỉ trả active
    // Admin gọi:       GET /products                → không truyền → trả tất cả
    status,
  } = req.query;

  const where = {};

  // ── Text search ──────────────────────────────
  if (search) where.title = { [Op.like]: `%${search}%` };

  // ── Category ────────────────────────────────
  if (category) where.category = category;

  // ── Brand ────────────────────────────────────
  const brands = parseArray(brand);
  if (brands.length === 1) where.brand = brands[0];
  if (brands.length  > 1) where.brand = { [Op.in]: brands };

  // Dùng !== undefined thay vì if (minPrice)
  // vì minPrice=0 là giá trị hợp lệ nhưng if (0) = false
  if (minPrice !== undefined && minPrice !== "") {
    where.price = { ...where.price, [Op.gte]: parseFloat(minPrice) };
  }
  if (maxPrice !== undefined && maxPrice !== "") {
    where.price = { ...where.price, [Op.lte]: parseFloat(maxPrice) };
  }

  // ── Spec filters ─────────────────────────────
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

  // ✅ THÊM MỚI: filter theo status
  // - Nếu client truyền status hợp lệ → lọc đúng status đó
  //   VD: ?status=active   → ListProduct chỉ thấy sản phẩm đang bán
  //       ?status=draft     → Admin xem bản nháp
  // - Nếu không truyền status (hoặc truyền sai) → không lọc → trả tất cả
  //   VD: Admin gọi GET /products không có status → thấy hết
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

// ─────────────────────────────────────────────
// GET /api/products/:id
// Giữ nguyên — không thay đổi
// ─────────────────────────────────────────────
router.get("/:id", catchAsync(async (req, res, next) => {
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

// ─────────────────────────────────────────────
// POST /api/products — Admin
// ─────────────────────────────────────────────
router.post("/", verifyToken, checkRole("admin"), catchAsync(async (req, res, next) => {
  const {
    brand, title, img, discount, price, oldPrice,
    category, nation, display, screenTech, ram, rom,
    chip, camera, battery, charging, description, stock, sold,
    // ✅ THÊM MỚI: nhận status từ body
    status,
  } = req.body;

  if (!brand || !title || !price || !category) {
    return next(new AppError("Thiếu thông tin bắt buộc: brand, title, price, category", 400));
  }

  // ✅ THÊM MỚI: validate status — nếu không hợp lệ thì dùng "active"
  const productStatus = VALID_STATUSES.includes(status) ? status : "active";

  const product = await Product.create({
    brand, title, img, discount, price, oldPrice,
    category, nation, display, screenTech, ram, rom,
    chip, camera, battery, charging, description,
    stock: stock || 50,
    sold:  sold  || 0,
    // ✅ THÊM MỚI
    status: productStatus,
  });

  const specsData = buildSpecs({ display, screenTech, ram, rom, chip, camera, battery, charging, nation });
  if (specsData.length > 0) {
    await ProductSpec.bulkCreate(specsData.map(s => ({ ...s, productId: product.id })));
  }

  return sendResponse(res, 201, "success", "Thêm sản phẩm thành công!", product);
}));

// ─────────────────────────────────────────────
// PUT /api/products/:id — Admin
// ─────────────────────────────────────────────
router.put("/:id", verifyToken, checkRole("admin"), catchAsync(async (req, res, next) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return next(new AppError("Product not found", 404));

  const {
    brand, title, img, discount, price, oldPrice,
    category, nation, display, screenTech, ram, rom,
    chip, camera, battery, charging, description, stock, sold,
    // ✅ THÊM MỚI: nhận status từ body
    status,
  } = req.body;

  await product.update({
    brand, title, img, discount, price, oldPrice,
    category, nation, display, screenTech, ram, rom,
    chip, camera, battery, charging, description, stock, sold,
    // ✅ THÊM MỚI: chỉ update status nếu hợp lệ
    // Nếu body không gửi status (undefined) → giữ nguyên status cũ trong DB
    // Nếu gửi status hợp lệ → cập nhật
    // Spread conditional để không ghi đè bằng undefined
    ...(VALID_STATUSES.includes(status) && { status }),
  });

  // Giữ nguyên logic specs — không thay đổi
  await ProductSpec.destroy({ where: { productId: product.id } });
  const specsData = buildSpecs({ display, screenTech, ram, rom, chip, camera, battery, charging, nation });
  if (specsData.length > 0) {
    await ProductSpec.bulkCreate(specsData.map(s => ({ ...s, productId: product.id })));
  }

  return sendResponse(res, 200, "success", "Cập nhật sản phẩm thành công!", product);
}));

// ─────────────────────────────────────────────
// DELETE /api/products/:id — Admin
// Giữ nguyên — không thay đổi
// ─────────────────────────────────────────────
router.delete("/:id", verifyToken, checkRole("admin"), catchAsync(async (req, res, next) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return next(new AppError("Product not found", 404));

  await ProductSpec.destroy({ where: { productId: product.id } });
  await product.destroy();

  return sendResponse(res, 200, "success", "Xóa sản phẩm thành công!");
}));

// ─────────────────────────────────────────────
// Helper: build specs array
// Giữ nguyên — không thay đổi
// ─────────────────────────────────────────────
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