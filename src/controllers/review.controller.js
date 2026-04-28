const { Op } = require("sequelize");
const sequelize = require("../config/db");
const { Review, Order, OrderItem, User, Product } = require("../models/index");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendResponse } = require("../utils/response");

// ─────────────────────────────────────────────
// Helper: cập nhật avgRating + totalReviews vào bảng products
// Dùng SQL AVG + COUNT thay vì findAll + tính tay — nhanh hơn nhiều
// ─────────────────────────────────────────────
const updateProductRating = async (productId) => {
  const result = await Review.findOne({
    where: { productId },
    attributes: [
      [sequelize.fn("AVG", sequelize.col("rating")), "avgRating"],
      [sequelize.fn("COUNT", sequelize.col("id")),   "totalReviews"],
    ],
    raw: true,
  });

  const avg   = result?.avgRating    ? parseFloat(parseFloat(result.avgRating).toFixed(1)) : 0;
  const total = result?.totalReviews ? parseInt(result.totalReviews) : 0;

  await Product.update(
    { avgRating: avg, totalReviews: total },
    { where: { id: productId } }
  );
};

// ─────────────────────────────────────────────
// GET /api/products/:id/reviews
// Cursor-based pagination — phù hợp sản phẩm hot có hàng nghìn reviews
// ─────────────────────────────────────────────
exports.getReviews = catchAsync(async (req, res, next) => {
  const productId = req.params.id;
  const limit     = parseInt(req.query.limit) || 10;
  const cursor    = req.query.cursor || null;

  const where = { productId };

  if (cursor) {
    where.createdAt = { [Op.lt]: new Date(parseInt(cursor)) };
  }

  const reviews = await Review.findAll({
    where,
    include: [{ model: User, attributes: ["id", "name"] }],
    order: [["createdAt", "DESC"]],
    limit: limit + 1,
  });

  const hasMore    = reviews.length > limit;
  const data       = hasMore ? reviews.slice(0, -1) : reviews;
  const nextCursor = hasMore
    ? data[data.length - 1].createdAt.getTime().toString()
    : null;

  // Lấy avgRating từ Product table — chính xác hơn tính từ page hiện tại
  const product = await Product.findByPk(productId, {
    attributes: ["avgRating", "totalReviews"],
  });

  return sendResponse(res, 200, "success", "OK", {
    reviews:      data,
    avgRating:    product?.avgRating    || 0,
    totalReviews: product?.totalReviews || 0,
    hasMore,
    nextCursor,
  });
});

// ─────────────────────────────────────────────
// POST /api/products/:id/reviews
// Chỉ user đã mua và nhận hàng thành công mới được review
// ─────────────────────────────────────────────
exports.createReview = catchAsync(async (req, res, next) => {
  const userId    = req.user.id;
  const productId = parseInt(req.params.id);
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return next(new AppError("Rating phải từ 1 đến 5", 400));
  }

  const hasPurchased = await Order.findOne({
    where: { userId, status: "completed" },
    include: [{
      model: OrderItem,
      where: { productId },
      required: true,
    }],
  });

  if (!hasPurchased) {
    return next(new AppError("Bạn cần mua và nhận hàng thành công mới được đánh giá!", 403));
  }

  const existing = await Review.findOne({ where: { userId, productId } });
  if (existing) {
    return next(new AppError("Bạn đã đánh giá sản phẩm này rồi!", 400));
  }

  const review = await Review.create({ userId, productId, rating, comment });
  await updateProductRating(productId);

  const result = await Review.findByPk(review.id, {
    include: [{ model: User, attributes: ["id", "name"] }],
  });

  return sendResponse(res, 201, "success", "Đánh giá thành công!", result);
});

// ─────────────────────────────────────────────
// DELETE /api/products/:id/reviews/:reviewId
// Chủ review hoặc admin mới được xóa
// ─────────────────────────────────────────────
exports.deleteReview = catchAsync(async (req, res, next) => {
  const review = await Review.findByPk(req.params.reviewId);
  if (!review) return next(new AppError("Review không tồn tại", 404));

  if (review.userId !== req.user.id && req.user.role !== "admin") {
    return next(new AppError("Không có quyền xóa review này", 403));
  }

  const productId = review.productId;
  await review.destroy();
  await updateProductRating(productId);

  return sendResponse(res, 200, "success", "Đã xóa đánh giá");
});

// ─────────────────────────────────────────────
// PATCH /api/products/:id/reviews/:reviewId/reply
// Chỉ admin mới được phản hồi
// ─────────────────────────────────────────────
exports.replyReview = catchAsync(async (req, res, next) => {
  if (req.user.role !== "admin") {
    return next(new AppError("Chỉ admin mới được phản hồi đánh giá!", 403));
  }

  const { reply } = req.body;
  if (!reply || !reply.trim()) {
    return next(new AppError("Nội dung trả lời không được để trống!", 400));
  }

  const review = await Review.findByPk(req.params.reviewId);
  if (!review) return next(new AppError("Review không tồn tại", 404));

  await review.update({
    reply:   reply.trim(),
    replyAt: new Date(),
  });

  return sendResponse(res, 200, "success", "Đã trả lời đánh giá!", {
    id:      review.id,
    reply:   review.reply,
    replyAt: review.replyAt,
  });
});