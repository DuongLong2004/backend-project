const { Wishlist, Product } = require("../models/index");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync"); // ✅ dùng catchAsync thống nhất, bỏ asyncWrapper
const { sendResponse } = require("../utils/response");

// GET /api/wishlist – Lấy danh sách yêu thích
exports.getWishlist = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const items = await Wishlist.findAll({
    where: { userId },
    include: [{
      model: Product,
      attributes: ["id", "title", "img", "price", "oldPrice", "discount",
                   "brand", "nation", "display", "ram", "rom", "stock", "sold"]
    }],
    order: [["createdAt", "DESC"]],
  });
  return sendResponse(res, 200, "success", "OK", items);
});

// POST /api/wishlist/:productId – Thêm vào yêu thích
exports.addWishlist = catchAsync(async (req, res, next) => {
  const userId    = req.user.id;
  const productId = parseInt(req.params.productId);

  const product = await Product.findByPk(productId);
  if (!product) return next(new AppError("Sản phẩm không tồn tại", 404));

  const [item, created] = await Wishlist.findOrCreate({
    where: { userId, productId }
  });

  if (!created) return next(new AppError("Sản phẩm đã có trong danh sách yêu thích!", 400));

  return sendResponse(res, 201, "success", "Đã thêm vào yêu thích! ❤️", item);
});

// DELETE /api/wishlist/:productId – Xóa khỏi yêu thích
exports.removeWishlist = catchAsync(async (req, res, next) => {
  const userId    = req.user.id;
  const productId = parseInt(req.params.productId);

  const item = await Wishlist.findOne({ where: { userId, productId } });
  if (!item) return next(new AppError("Không tìm thấy trong danh sách yêu thích", 404));

  await item.destroy();
  return sendResponse(res, 200, "success", "Đã xóa khỏi yêu thích");
});

// GET /api/wishlist/ids – Lấy danh sách productId đã thích (để check nhanh)
exports.getWishlistIds = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const items  = await Wishlist.findAll({
    where: { userId },
    attributes: ["productId"]
  });
  const ids = items.map(i => i.productId);
  return sendResponse(res, 200, "success", "OK", ids);
});