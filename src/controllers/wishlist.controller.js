const wishlistService  = require("../services/wishlist.service");
const catchAsync       = require("../utils/catchAsync");
const { sendResponse } = require("../utils/response");

// GET /api/wishlist
exports.getWishlist = catchAsync(async (req, res) => {
  const data = await wishlistService.getWishlist(req.user.id);
  return sendResponse(res, 200, "success", "OK", data);
});

// GET /api/wishlist/ids
exports.getWishlistIds = catchAsync(async (req, res) => {
  const data = await wishlistService.getWishlistIds(req.user.id);
  return sendResponse(res, 200, "success", "OK", data);
});

// POST /api/wishlist/:productId
exports.addWishlist = catchAsync(async (req, res) => {
  const data = await wishlistService.addWishlist({
    userId:    req.user.id,
    productId: parseInt(req.params.productId),
  });
  return sendResponse(res, 201, "success", "Đã thêm vào yêu thích! ❤️", data);
});

// DELETE /api/wishlist/:productId
exports.removeWishlist = catchAsync(async (req, res) => {
  await wishlistService.removeWishlist({
    userId:    req.user.id,
    productId: parseInt(req.params.productId),
  });
  return sendResponse(res, 200, "success", "Đã xóa khỏi yêu thích");
});