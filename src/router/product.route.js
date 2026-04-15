// const express   = require("express");
// const router    = express.Router();
// const { Product, ProductSpec } = require("../models/index"); // ✅ thêm ProductSpec
// const { sendResponse } = require("../utils/response");
// const { Op }    = require("sequelize");
// const { verifyToken } = require("../middlewares/auth.middleware");
// const checkRole = require("../middlewares/checkRole");

// const parsePrice = (priceStr) => {
//   return parseFloat(priceStr.replace(/[^0-9]/g, ""));
// };

// // ✅ GET /api/products – Danh sách sản phẩm
// router.get("/", async (req, res) => {
//   try {
//     const page   = parseInt(req.query.page)  || 1;
//     const limit  = parseInt(req.query.limit) || 10;
//     const offset = (page - 1) * limit;
//     const { search, brand, category, minPrice, maxPrice } = req.query;

//     const where = {};
//     if (search)   where.title    = { [Op.like]: `%${search}%` };
//     if (brand)    where.brand    = brand;
//     if (category) where.category = category;

//     let { count, rows } = await Product.findAndCountAll({
//       where,
//       order: [["createdAt", "DESC"]],
//     });

//     if (minPrice || maxPrice) {
//       rows = rows.filter((p) => {
//         const price = parsePrice(p.price);
//         if (minPrice && price < parseFloat(minPrice)) return false;
//         if (maxPrice && price > parseFloat(maxPrice)) return false;
//         return true;
//       });
//       count = rows.length;
//     }

//     const paginated = rows.slice(offset, offset + limit);
//     return sendResponse(res, 200, "success", "OK", {
//       data: paginated,
//       meta: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
//     });
//   } catch (err) {
//     return sendResponse(res, 500, "error", err.message);
//   }
// });

// // ✅ GET /api/products/:id – Chi tiết sản phẩm + specs
// router.get("/:id", async (req, res) => {
//   try {
//     const product = await Product.findByPk(req.params.id, {
//       include: [{
//         model: ProductSpec,
//         as: "specs",
//         attributes: ["specKey", "specValue", "sortOrder"],
//       }],
//       order: [[{ model: ProductSpec, as: "specs" }, "sortOrder", "ASC"]],
//     });
//     if (!product) return sendResponse(res, 404, "error", "Product not found");
//     return sendResponse(res, 200, "success", "OK", product);
//   } catch (err) {
//     return sendResponse(res, 500, "error", err.message);
//   }
// });

// // ✅ POST /api/products – Admin thêm sản phẩm mới
// router.post("/", verifyToken, checkRole("admin"), async (req, res) => {
//   try {
//     const {
//       brand, title, img, discount, price, oldPrice,
//       category, nation, display, screenTech, ram, rom,
//       chip, camera, battery, charging, description,
//       stock, sold
//     } = req.body;

//     if (!brand || !title || !price || !category) {
//       return sendResponse(res, 400, "error", "Thiếu thông tin bắt buộc: brand, title, price, category");
//     }

//     const product = await Product.create({
//       brand, title, img, discount, price, oldPrice,
//       category, nation, display, screenTech, ram, rom,
//       chip, camera, battery, charging, description,
//       stock: stock || 50,
//       sold:  sold  || 0,
//     });

//     // ✅ Tạo specs cho sản phẩm mới
//     const specsData = [
//       { specKey: "display",    specValue: display,    sortOrder: 1 },
//       { specKey: "screenTech", specValue: screenTech, sortOrder: 2 },
//       { specKey: "ram",        specValue: ram,        sortOrder: 3 },
//       { specKey: "rom",        specValue: rom,        sortOrder: 4 },
//       { specKey: "chip",       specValue: chip,       sortOrder: 5 },
//       { specKey: "camera",     specValue: camera,     sortOrder: 6 },
//       { specKey: "battery",    specValue: battery,    sortOrder: 7 },
//       { specKey: "charging",   specValue: charging,   sortOrder: 8 },
//       { specKey: "nation",     specValue: nation,     sortOrder: 9 },
//     ].filter(s => s.specValue);

//     if (specsData.length > 0) {
//       await ProductSpec.bulkCreate(
//         specsData.map(s => ({ ...s, productId: product.id }))
//       );
//     }

//     return sendResponse(res, 201, "success", "Thêm sản phẩm thành công!", product);
//   } catch (err) {
//     return sendResponse(res, 500, "error", err.message);
//   }
// });

// // ✅ PUT /api/products/:id – Admin cập nhật sản phẩm
// router.put("/:id", verifyToken, checkRole("admin"), async (req, res) => {
//   try {
//     const product = await Product.findByPk(req.params.id);
//     if (!product) return sendResponse(res, 404, "error", "Product not found");

//     const {
//       brand, title, img, discount, price, oldPrice,
//       category, nation, display, screenTech, ram, rom,
//       chip, camera, battery, charging, description,
//       stock, sold
//     } = req.body;

//     await product.update({
//       brand, title, img, discount, price, oldPrice,
//       category, nation, display, screenTech, ram, rom,
//       chip, camera, battery, charging, description,
//       stock, sold
//     });

//     // ✅ Cập nhật specs
//     await ProductSpec.destroy({ where: { productId: product.id } });

//     const specsData = [
//       { specKey: "display",    specValue: display,    sortOrder: 1 },
//       { specKey: "screenTech", specValue: screenTech, sortOrder: 2 },
//       { specKey: "ram",        specValue: ram,        sortOrder: 3 },
//       { specKey: "rom",        specValue: rom,        sortOrder: 4 },
//       { specKey: "chip",       specValue: chip,       sortOrder: 5 },
//       { specKey: "camera",     specValue: camera,     sortOrder: 6 },
//       { specKey: "battery",    specValue: battery,    sortOrder: 7 },
//       { specKey: "charging",   specValue: charging,   sortOrder: 8 },
//       { specKey: "nation",     specValue: nation,     sortOrder: 9 },
//     ].filter(s => s.specValue);

//     if (specsData.length > 0) {
//       await ProductSpec.bulkCreate(
//         specsData.map(s => ({ ...s, productId: product.id }))
//       );
//     }

//     return sendResponse(res, 200, "success", "Cập nhật sản phẩm thành công!", product);
//   } catch (err) {
//     return sendResponse(res, 500, "error", err.message);
//   }
// });

// // ✅ DELETE /api/products/:id – Admin xóa sản phẩm
// router.delete("/:id", verifyToken, checkRole("admin"), async (req, res) => {
//   try {
//     const product = await Product.findByPk(req.params.id);
//     if (!product) return sendResponse(res, 404, "error", "Product not found");

//     // ✅ Xóa specs trước (FK cascade)
//     await ProductSpec.destroy({ where: { productId: product.id } });
//     await product.destroy();

//     return sendResponse(res, 200, "success", "Xóa sản phẩm thành công!");
//   } catch (err) {
//     return sendResponse(res, 500, "error", err.message);
//   }
// });

// module.exports = router;


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
// GET /api/products
// ─────────────────────────────────────────────
router.get("/", catchAsync(async (req, res, next) => {
  const page   = parseInt(req.query.page)  || 1;
  const limit  = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { search, brand, category, minPrice, maxPrice } = req.query;

  const where = {};
  if (search)   where.title    = { [Op.like]: `%${search}%` };
  if (brand)    where.brand    = brand;
  if (category) where.category = category;

  // ✅ Filter giá bằng SQL thay vì filter sau khi query — hiệu quả hơn
  if (minPrice) where.price = { ...where.price, [Op.gte]: parseFloat(minPrice) };
  if (maxPrice) where.price = { ...where.price, [Op.lte]: parseFloat(maxPrice) };

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
  } = req.body;

  if (!brand || !title || !price || !category) {
    return next(new AppError("Thiếu thông tin bắt buộc: brand, title, price, category", 400));
  }

  const product = await Product.create({
    brand, title, img, discount, price, oldPrice,
    category, nation, display, screenTech, ram, rom,
    chip, camera, battery, charging, description,
    stock: stock || 50,
    sold:  sold  || 0,
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
  } = req.body;

  await product.update({
    brand, title, img, discount, price, oldPrice,
    category, nation, display, screenTech, ram, rom,
    chip, camera, battery, charging, description, stock, sold,
  });

  // ✅ Xóa specs cũ rồi tạo lại
  await ProductSpec.destroy({ where: { productId: product.id } });
  const specsData = buildSpecs({ display, screenTech, ram, rom, chip, camera, battery, charging, nation });
  if (specsData.length > 0) {
    await ProductSpec.bulkCreate(specsData.map(s => ({ ...s, productId: product.id })));
  }

  return sendResponse(res, 200, "success", "Cập nhật sản phẩm thành công!", product);
}));

// ─────────────────────────────────────────────
// DELETE /api/products/:id — Admin
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