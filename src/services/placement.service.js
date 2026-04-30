const { Op }       = require("sequelize");
const sequelize    = require("../config/db");
const { Product, ProductPlacement } = require("../models/index");
const AppError     = require("../utils/AppError");

const VALID_PLACEMENTS = ["homepage", "phones", "laptops", "flashsale"];

const calcStockLeft = (stockLimit, stockSold) =>
  stockLimit !== null ? Math.max(0, stockLimit - stockSold) : null;

exports.getPlacements = async (placement) => {
  if (!placement || !VALID_PLACEMENTS.includes(placement)) {
    throw new AppError("placement không hợp lệ", 400);
  }

  const now   = new Date();
  const where = { placement };

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
        where:      { status: "active" },
        attributes: [
          "id", "brand", "title", "img", "category", "price", "oldPrice",
          "discount", "stock", "sold", "avgRating", "totalReviews",
        ],
      },
    ],
  });

  return rows.map((p) => {
    const item       = p.product.toJSON();
    item.placementId = p.id;
    item.sortOrder   = p.sortOrder;

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

exports.reorderPlacements = async ({ placement, items }) => {
  if (!placement || !Array.isArray(items) || items.length === 0) {
    throw new AppError("Cần truyền placement và items[]", 400);
  }

  if (!VALID_PLACEMENTS.includes(placement)) {
    throw new AppError("placement không hợp lệ", 400);
  }

  /*
   * Bulk update bằng CASE WHEN thay vì N queries riêng lẻ.
   * sequelize.escape() sanitize từng giá trị trước khi interpolate
   * vào raw query để tránh SQL injection.
   */
  const cases = items
    .map(({ id, sortOrder }) =>
      `WHEN ${sequelize.escape(id)} THEN ${sequelize.escape(sortOrder)}`
    )
    .join(" ");

  const ids = items.map(({ id }) => sequelize.escape(id)).join(", ");

  await sequelize.query(`
    UPDATE product_placements
    SET sortOrder = CASE id ${cases} END
    WHERE id IN (${ids})
    AND placement = ${sequelize.escape(placement)}
  `);
};

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

  const result     = entry.toJSON();
  result.stockLeft = calcStockLeft(result.stockLimit, result.stockSold);

  return result;
};

exports.resetStock = async (id) => {
  const entry = await ProductPlacement.findByPk(id);
  if (!entry) throw new AppError("Không tìm thấy placement", 404);

  await entry.update({ stockSold: 0 });

  return {
    id:         entry.id,
    stockSold:  0,
    stockLimit: entry.stockLimit,
    stockLeft:  entry.stockLimit,
  };
};

exports.deleteBulk = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError("Cần truyền ids[]", 400);
  }

  const deleted = await ProductPlacement.destroy({ where: { id: ids } });
  return { deleted };
};

exports.deletePlacement = async (id) => {
  const entry = await ProductPlacement.findByPk(id);
  if (!entry) throw new AppError("Không tìm thấy placement", 404);

  await entry.destroy();
};