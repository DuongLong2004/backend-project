const productService   = require("../services/product.service");
const catchAsync       = require("../utils/catchAsync");
const { sendResponse } = require("../utils/response");

// GET /api/products
exports.getProducts = catchAsync(async (req, res) => {
  const data = await productService.getProducts(req.query);
  return sendResponse(res, 200, "success", "OK", data);
});

// GET /api/products/:id
exports.getProductById = catchAsync(async (req, res) => {
  const data = await productService.getProductById(req.params.id);
  return sendResponse(res, 200, "success", "OK", data);
});

// POST /api/products  (admin)
exports.createProduct = catchAsync(async (req, res) => {
  const data = await productService.createProduct(req.body);
  return sendResponse(res, 201, "success", "Thêm sản phẩm thành công!", data);
});

// PUT /api/products/:id  (admin)
exports.updateProduct = catchAsync(async (req, res) => {
  const data = await productService.updateProduct(req.params.id, req.body);
  return sendResponse(res, 200, "success", "Cập nhật sản phẩm thành công!", data);
});

// DELETE /api/products/:id  (admin)
exports.deleteProduct = catchAsync(async (req, res) => {
  await productService.deleteProduct(req.params.id);
  return sendResponse(res, 200, "success", "Xóa sản phẩm thành công!");
});