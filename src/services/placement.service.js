const { Op } = require("sequelize");
const { Product, ProductPlacement } = require("../models/index");
const AppError = require("../utils/AppError");

const VALID_PLACEMENTS = ["homepage", "phones", "laptops", "flashsale"];

// ─────────────────────────────────────────────
// Private helper
// Tính stockLeft từ stockLimit và stockSold
// NULL stockLimit = không giới hạn
// ─────────────────────────────────────────────
const calcStockLeft = (stockLimit, stockSold) =>
  stockLimit !== null ? Math.max(0, stockLimit - stockSold) : null;

// ─────────────────────────────────────────────
// getPlacements(placement)
// → item[] (dành cho FE user)
// Flash sale: chỉ lấy những entry còn hạn
// ─────────────────────────────────────────────
exports.getPlacements = async (placement) => {
  if (!placement || !VALID_PLACEMENTS.includes(placement)) {
    throw new AppError("placement không hợp lệ", 400);
  }

  const now   = new Date();
  const where = { placement };

  // Flash sale: lọc bỏ entry đã hết hạn
  if (placement === "flashsale") {
    where[Op.or] = [
      { saleEndAt: null },
      { saleEndAt: { [Op.gte]: now } },
    ];
  }

  const rows = await ProductPlacement.findAll({
    where,
    order:   [["sortOrder", "ASC"]],
    include: [
      {
        model:      Product,
        as:         "product",
        where:      { status: "active" }, // chỉ hiện sản phẩm đang bán
        attributes: [
          "id", "brand", "title", "img", "category", "price", "oldPrice",
          "discount", "stock", "sold", "avgRating", "totalReviews",
        ],
      },
    ],
  });

  return rows.map((p) => {
    const item        = p.product.toJSON();
    item.placementId  = p.id;
    item.sortOrder    = p.sortOrder;

    if (placement === "flashsale") {
      item.salePrice   = p.salePrice;
      item.saleStartAt = p.saleStartAt;
      item.saleEndAt   = p.saleEndAt;
      item.stockLimit  = p.stockLimit;
      item.stockSold   = p.stockSold;
      item.stockLeft   = calcStockLeft(p.stockLimit, p.stockSold);
    }

    return item;
  });
};

// ─────────────────────────────────────────────
// getPlacementsAdmin(placement)
// → ProductPlacement[] (dành cho admin panel)
// Không filter thời gian — admin thấy tất cả
// ─────────────────────────────────────────────
exports.getPlacementsAdmin = async (placement) => {
  if (!placement || !VALID_PLACEMENTS.includes(placement)) {
    throw new AppError("placement không hợp lệ", 400);
  }

  const rows = await ProductPlacement.findAll({
    where:   { placement },
    order:   [["sortOrder", "ASC"]],
    include: [
      {
        model:      Product,
        as:         "product",
        attributes: ["id", "brand", "title", "img", "category", "price", "oldPrice", "stock", "status"],
      },
    ],
  });

  return rows.map((row) => {
    const obj = row.toJSON();
    if (placement === "flashsale") {
      obj.stockLeft = calcStockLeft(obj.stockLimit, obj.stockSold);
    }
    return obj;
  });
};

// ─────────────────────────────────────────────
// createPlacement({ productId, placement, salePrice, saleStartAt, saleEndAt, stockLimit })
// → ProductPlacement
// ─────────────────────────────────────────────
exports.createPlacement = async ({ productId, placement, salePrice, saleStartAt, saleEndAt, stockLimit }) => {
  if (!productId || !placement) {
    throw new AppError("Thiếu productId hoặc placement", 400);
  }

  if (!VALID_PLACEMENTS.includes(placement)) {
    throw new AppError("placement không hợp lệ", 400);
  }

  const product = await Product.findByPk(productId);
  if (!product) throw new AppError("Sản phẩm không tồn tại", 404);

  const existing = await ProductPlacement.findOne({ where: { productId, placement } });
  if (existing) throw new AppError("Sản phẩm đã được thêm vào vị trí này rồi", 409);

  if (placement === "flashsale" && !salePrice) {
    throw new AppError("Flash sale cần có salePrice", 400);
  }

  // Tính sortOrder tiếp theo — đặt cuối danh sách
  const maxOrder = (await ProductPlacement.max("sortOrder", { where: { placement } })) || 0;

  return ProductPlacement.create({
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
};

// ─────────────────────────────────────────────
// reorderPlacements({ placement, items })
// → void
// items = [{ id, sortOrder }, ...]
// ─────────────────────────────────────────────
exports.reorderPlacements = async ({ placement, items }) => {
  if (!placement || !Array.isArray(items) || items.length === 0) {
    throw new AppError("Cần truyền placement và items[]", 400);
  }

  if (!VALID_PLACEMENTS.includes(placement)) {
    throw new AppError("placement không hợp lệ", 400);
  }

  await Promise.all(
    items.map(({ id, sortOrder }) =>
      ProductPlacement.update({ sortOrder }, { where: { id, placement } })
    )
  );
};

// ─────────────────────────────────────────────
// updatePlacement({ id, salePrice, saleStartAt, saleEndAt, stockLimit })
// → { ...entry, stockLeft }
// stockSold KHÔNG được update ở đây — chỉ tăng qua order transaction
// ─────────────────────────────────────────────
exports.updatePlacement = async ({ id, salePrice, saleStartAt, saleEndAt, stockLimit }) => {
  const entry = await ProductPlacement.findByPk(id);
  if (!entry) throw new AppError("Không tìm thấy placement", 404);

  await entry.update({
    ...(salePrice   !== undefined && { salePrice }),
    ...(saleStartAt !== undefined && { saleStartAt }),
    ...(saleEndAt   !== undefined && { saleEndAt }),
    ...(stockLimit  !== undefined && {
      stockLimit: stockLimit !== null ? parseInt(stockLimit, 10) : null,
    }),
  });

  const result      = entry.toJSON();
  result.stockLeft  = calcStockLeft(result.stockLimit, result.stockSold);

  return result;
};

// ─────────────────────────────────────────────
// resetStock(id)
// → { id, stockSold, stockLimit, stockLeft }
// Reset stockSold về 0 khi bắt đầu đợt flash sale mới
// ─────────────────────────────────────────────
exports.resetStock = async (id) => {
  const entry = await ProductPlacement.findByPk(id);
  if (!entry) throw new AppError("Không tìm thấy placement", 404);

  await entry.update({ stockSold: 0 });

  return {
    id:         entry.id,
    stockSold:  0,
    stockLimit: entry.stockLimit,
    stockLeft:  entry.stockLimit, // stockSold = 0 nên stockLeft = stockLimit
  };
};

// ─────────────────────────────────────────────
// deleteBulk(ids)
// → { deleted }
// Xóa nhiều placement cùng lúc
// ─────────────────────────────────────────────
exports.deleteBulk = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError("Cần truyền ids[]", 400);
  }

  const deleted = await ProductPlacement.destroy({ where: { id: ids } });
  return { deleted };
};

// ─────────────────────────────────────────────
// deletePlacement(id)
// → void
// ─────────────────────────────────────────────
exports.deletePlacement = async (id) => {
  const entry = await ProductPlacement.findByPk(id);
  if (!entry) throw new AppError("Không tìm thấy placement", 404);

  await entry.destroy();
};