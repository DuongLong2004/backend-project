const { User, Product } = require("../models/index");
const AppError = require("../utils/AppError");

// ─────────────────────────────────────────────
// Private helper
// Build URL từ filename — đọc BASE_URL từ .env
// không hardcode localhost
// ─────────────────────────────────────────────
const buildFileUrl = (filename) => {
  const baseUrl = process.env.BASE_URL || "http://localhost:5000";
  return `${baseUrl}/uploads/${filename}`;
};

// ─────────────────────────────────────────────
// uploadAvatar({ userId, file })
// → { url }
// ─────────────────────────────────────────────
exports.uploadAvatar = async ({ userId, file }) => {
  if (!file) throw new AppError("No file uploaded", 400);

  const url = buildFileUrl(file.filename);
  await User.update({ avatar: url }, { where: { id: userId } });

  return { url };
};

// ─────────────────────────────────────────────
// uploadProductImage({ productId, file })
// → { url }
// ─────────────────────────────────────────────
exports.uploadProductImage = async ({ productId, file }) => {
  if (!file) throw new AppError("No file uploaded", 400);

  const product = await Product.findByPk(productId);
  if (!product) throw new AppError("Product not found", 404);

  const url = buildFileUrl(file.filename);
  await product.update({ img: url });

  return { url };
};