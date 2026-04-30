const uploadService    = require("../services/upload.service");
const catchAsync       = require("../utils/catchAsync");
const { sendResponse } = require("../utils/response");

// POST /api/users/avatar
exports.uploadAvatar = catchAsync(async (req, res) => {
  const data = await uploadService.uploadAvatar({
    userId: req.user.id,
    file:   req.file,
  });
  return sendResponse(res, 200, "success", "Avatar uploaded", data);
});

// POST /api/products/:id/image
exports.uploadProductImage = catchAsync(async (req, res) => {
  const data = await uploadService.uploadProductImage({
    productId: req.params.id,
    file:      req.file,
  });
  return sendResponse(res, 200, "success", "Product image uploaded", data);
});