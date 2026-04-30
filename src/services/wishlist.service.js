const { Wishlist, Product } = require("../models/index");
const AppError = require("../utils/AppError");

// ─────────────────────────────────────────────
// getWishlist(userId)
// → Wishlist[] (kèm Product)
// ─────────────────────────────────────────────
exports.getWishlist = async (userId) => {
  return Wishlist.findAll({
    where:   { userId },
    include: [
      {
        model:      Product,
        attributes: [
          "id", "title", "img", "price", "oldPrice", "discount",
          "brand", "nation", "display", "ram", "rom", "stock", "sold",
        ],
      },
    ],
    order: [["createdAt", "DESC"]],
  });
};

// ─────────────────────────────────────────────
// getWishlistIds(userId)
// → number[]
// Dùng để FE check nhanh sản phẩm nào đã được thích
// ─────────────────────────────────────────────
exports.getWishlistIds = async (userId) => {
  const items = await Wishlist.findAll({
    where:      { userId },
    attributes: ["productId"],
  });
  return items.map((i) => i.productId);
};

// ─────────────────────────────────────────────
// addWishlist({ userId, productId })
// → Wishlist
// ─────────────────────────────────────────────
exports.addWishlist = async ({ userId, productId }) => {
  const product = await Product.findByPk(productId);
  if (!product) throw new AppError("Sản phẩm không tồn tại", 404);

  const [item, created] = await Wishlist.findOrCreate({
    where: { userId, productId },
  });

  if (!created) throw new AppError("Sản phẩm đã có trong danh sách yêu thích!", 400);

  return item;
};

// ─────────────────────────────────────────────
// removeWishlist({ userId, productId })
// → void
// ─────────────────────────────────────────────
exports.removeWishlist = async ({ userId, productId }) => {
  const item = await Wishlist.findOne({ where: { userId, productId } });
  if (!item) throw new AppError("Không tìm thấy trong danh sách yêu thích", 404);

  await item.destroy();
};