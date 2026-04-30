const placementService = require("../services/placement.service");
const catchAsync       = require("../utils/catchAsync");
const { sendResponse } = require("../utils/response");

// GET /api/placements?placement=xxx  (public)
exports.getPlacements = catchAsync(async (req, res) => {
  const data = await placementService.getPlacements(req.query.placement);
  return sendResponse(res, 200, "success", "OK", data);
});

// GET /api/placements/admin?placement=xxx  (admin)
exports.getPlacementsAdmin = catchAsync(async (req, res) => {
  const data = await placementService.getPlacementsAdmin(req.query.placement);
  return sendResponse(res, 200, "success", "OK", data);
});

// POST /api/placements  (admin)
exports.createPlacement = catchAsync(async (req, res) => {
  const data = await placementService.createPlacement(req.body);
  return sendResponse(res, 201, "success", "Đã thêm sản phẩm vào vị trí!", data);
});

// PUT /api/placements/reorder  (admin)
exports.reorderPlacements = catchAsync(async (req, res) => {
  await placementService.reorderPlacements(req.body);
  return sendResponse(res, 200, "success", "Đã cập nhật thứ tự!");
});

// PUT /api/placements/:id  (admin)
exports.updatePlacement = catchAsync(async (req, res) => {
  const data = await placementService.updatePlacement({
    id: req.params.id,
    ...req.body,
  });
  return sendResponse(res, 200, "success", "Cập nhật thành công!", data);
});

// POST /api/placements/:id/reset-stock  (admin)
exports.resetStock = catchAsync(async (req, res) => {
  const data = await placementService.resetStock(req.params.id);
  return sendResponse(res, 200, "success", "Đã reset stockSold về 0!", data);
});

// DELETE /api/placements/bulk  (admin)
exports.deleteBulk = catchAsync(async (req, res) => {
  const data = await placementService.deleteBulk(req.body.ids);
  return sendResponse(res, 200, "success", `Đã xóa ${data.deleted} sản phẩm!`, data);
});

// DELETE /api/placements/:id  (admin)
exports.deletePlacement = catchAsync(async (req, res) => {
  await placementService.deletePlacement(req.params.id);
  return sendResponse(res, 200, "success", "Đã xóa sản phẩm khỏi vị trí!");
});