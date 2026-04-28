const { Op } = require("sequelize");
const { Product, ProductPlacement } = require("../models/index");
const { sendResponse } = require("../utils/response");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

const VALID_PLACEMENTS = ["homepage", "phones", "laptops", "flashsale"];

/* ─────────────────────────────────────────────
   GET /api/placements?placement=xxx  — FE user
───────────────────────────────────────────── */
exports.getPlacements = catchAsync(async (req, res, next) => {
  const { placement } = req.query;

  if (!placement || !VALID_PLACEMENTS.includes(placement))
    return next(new AppError("placement không hợp lệ", 400));

  const now = new Date();
  const where = { placement };

  if (placement === "flashsale") {
    where[Op.or] = [
      { saleEndAt: null },
      { saleEndAt: { [Op.gte]: now } },
    ];
  }

  const rows = await ProductPlacement.findAll({
    where,
    order: [["sortOrder", "ASC"]],
    include: [{
      model: Product,
      as: "product",
      where: { status: "active" },
      attributes: ["id", "brand", "title", "img", "category", "price", "oldPrice",
                   "discount", "stock", "sold", "avgRating", "totalReviews"],
    }],
  });

  const data = rows.map(p => {
    const item = p.product.toJSON();
    item.placementId = p.id;
    item.sortOrder   = p.sortOrder;

    if (placement === "flashsale") {
      item.salePrice   = p.salePrice;
      item.saleStartAt = p.saleStartAt;
      item.saleEndAt   = p.saleEndAt;
      item.stockLimit  = p.stockLimit;
      item.stockSold   = p.stockSold;
      item.stockLeft   = p.stockLimit !== null
        ? Math.max(0, p.stockLimit - p.stockSold)
        : null;
    }

    return item;
  });

  return sendResponse(res, 200, "success", "OK", data);
});

/* ─────────────────────────────────────────────
   GET /api/placements/admin?placement=xxx  — Admin panel
───────────────────────────────────────────── */
exports.getPlacementsAdmin = catchAsync(async (req, res, next) => {
  const { placement } = req.query;

  if (!placement || !VALID_PLACEMENTS.includes(placement))
    return next(new AppError("placement không hợp lệ", 400));

  const rows = await ProductPlacement.findAll({
    where: { placement },
    order: [["sortOrder", "ASC"]],
    include: [{
      model: Product,
      as: "product",
      attributes: ["id", "brand", "title", "img", "category", "price", "oldPrice", "stock", "status"],
    }],
  });

  const data = rows.map(row => {
    const obj = row.toJSON();
    if (placement === "flashsale") {
      obj.stockLeft = obj.stockLimit !== null
        ? Math.max(0, obj.stockLimit - obj.stockSold)
        : null;
    }
    return obj;
  });

  return sendResponse(res, 200, "success", "OK", data);
});

/* ─────────────────────────────────────────────
   POST /api/placements  — Thêm sản phẩm vào placement
───────────────────────────────────────────── */
exports.createPlacement = catchAsync(async (req, res, next) => {
  const { productId, placement, salePrice, saleStartAt, saleEndAt, stockLimit } = req.body;

  if (!productId || !placement)
    return next(new AppError("Thiếu productId hoặc placement", 400));
  if (!VALID_PLACEMENTS.includes(placement))
    return next(new AppError("placement không hợp lệ", 400));

  const product = await Product.findByPk(productId);
  if (!product) return next(new AppError("Sản phẩm không tồn tại", 404));

  const existing = await ProductPlacement.findOne({ where: { productId, placement } });
  if (existing) return next(new AppError("Sản phẩm đã được thêm vào vị trí này rồi", 409));

  if (placement === "flashsale" && !salePrice)
    return next(new AppError("Flash sale cần có salePrice", 400));

  const maxOrder = await ProductPlacement.max("sortOrder", { where: { placement } }) || 0;

  const entry = await ProductPlacement.create({
    productId,
    placement,
    sortOrder:   maxOrder + 1,
    salePrice:   placement === "flashsale" ? salePrice   : null,
    saleStartAt: placement === "flashsale" ? saleStartAt : null,
    saleEndAt:   placement === "flashsale" ? saleEndAt   : null,
    stockLimit:  placement === "flashsale" && stockLimit != null
      ? parseInt(stockLimit, 10)
      : null,
    stockSold: 0,
  });

  return sendResponse(res, 201, "success", "Đã thêm sản phẩm vào vị trí!", entry);
});

/* ─────────────────────────────────────────────
   PUT /api/placements/reorder  — Sắp xếp lại thứ tự
───────────────────────────────────────────── */
exports.reorderPlacements = catchAsync(async (req, res, next) => {
  const { placement, items } = req.body;

  if (!placement || !Array.isArray(items) || items.length === 0)
    return next(new AppError("Cần truyền placement và items[]", 400));
  if (!VALID_PLACEMENTS.includes(placement))
    return next(new AppError("placement không hợp lệ", 400));

  await Promise.all(items.map(({ id, sortOrder }) =>
    ProductPlacement.update({ sortOrder }, { where: { id, placement } })
  ));

  return sendResponse(res, 200, "success", "Đã cập nhật thứ tự!");
});

/* ─────────────────────────────────────────────
   PUT /api/placements/:id  — Cập nhật flash sale info
───────────────────────────────────────────── */
exports.updatePlacement = catchAsync(async (req, res, next) => {
  const entry = await ProductPlacement.findByPk(req.params.id);
  if (!entry) return next(new AppError("Không tìm thấy placement", 404));

  const { salePrice, saleStartAt, saleEndAt, stockLimit } = req.body;

  await entry.update({
    ...(salePrice   !== undefined && { salePrice }),
    ...(saleStartAt !== undefined && { saleStartAt }),
    ...(saleEndAt   !== undefined && { saleEndAt }),
    ...(stockLimit  !== undefined && {
      stockLimit: stockLimit !== null ? parseInt(stockLimit, 10) : null,
    }),
    // stockSold KHÔNG update ở đây dù FE có gửi lên
  });

  const result = entry.toJSON();
  result.stockLeft = result.stockLimit !== null
    ? Math.max(0, result.stockLimit - result.stockSold)
    : null;

  return sendResponse(res, 200, "success", "Cập nhật thành công!", result);
});

/* ─────────────────────────────────────────────
   POST /api/placements/:id/reset-stock  — Reset stockSold về 0
───────────────────────────────────────────── */
exports.resetStock = catchAsync(async (req, res, next) => {
  const entry = await ProductPlacement.findByPk(req.params.id);
  if (!entry) return next(new AppError("Không tìm thấy placement", 404));

  await entry.update({ stockSold: 0 });

  return sendResponse(res, 200, "success", "Đã reset stockSold về 0!", {
    id:         entry.id,
    stockSold:  0,
    stockLimit: entry.stockLimit,
    stockLeft:  entry.stockLimit,
  });
});

/* ─────────────────────────────────────────────
   DELETE /api/placements/bulk  — Xóa nhiều cùng lúc
───────────────────────────────────────────── */
exports.deleteBulk = catchAsync(async (req, res, next) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0)
    return next(new AppError("Cần truyền ids[]", 400));

  const deleted = await ProductPlacement.destroy({ where: { id: ids } });

  return sendResponse(res, 200, "success", `Đã xóa ${deleted} sản phẩm!`, { deleted });
});

/* ─────────────────────────────────────────────
   DELETE /api/placements/:id  — Xóa 1
───────────────────────────────────────────── */
exports.deletePlacement = catchAsync(async (req, res, next) => {
  const entry = await ProductPlacement.findByPk(req.params.id);
  if (!entry) return next(new AppError("Không tìm thấy placement", 404));

  await entry.destroy();
  return sendResponse(res, 200, "success", "Đã xóa sản phẩm khỏi vị trí!");
});