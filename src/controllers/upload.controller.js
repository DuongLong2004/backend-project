
const { User, Product } = require("../models/index");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendResponse } = require("../utils/response");

// ─────────────────────────────────────────────
// POST /api/users/avatar
// ─────────────────────────────────────────────
exports.uploadAvatar = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("No file uploaded", 400));
  }

  // ✅ Đọc BASE_URL từ .env — không hardcode localhost
  const baseUrl = process.env.BASE_URL || "http://localhost:5000";
  const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

  await User.update({ avatar: fileUrl }, { where: { id: req.user.id } });

  return sendResponse(res, 200, "success", "Avatar uploaded", { url: fileUrl });
});

// ─────────────────────────────────────────────
// POST /api/products/:id/image
// ─────────────────────────────────────────────
exports.uploadProductImage = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("No file uploaded", 400));
  }

  const product = await Product.findByPk(req.params.id);
  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  // ✅ Đọc BASE_URL từ .env
  const baseUrl = process.env.BASE_URL || "http://localhost:5000";
  const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

  await product.update({ img: fileUrl });

  return sendResponse(res, 200, "success", "Product image uploaded", { url: fileUrl });
});