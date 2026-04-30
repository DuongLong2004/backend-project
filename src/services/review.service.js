const { Op }    = require("sequelize");
const sequelize = require("../config/db");
const { Review, Order, OrderItem, User, Product } = require("../models/index");
const AppError  = require("../utils/AppError");

// ─────────────────────────────────────────────
// Private helper
// Dùng SQL AVG + COUNT thay vì findAll + tính tay — nhanh hơn nhiều
// Gọi sau mỗi lần tạo / xóa review để giữ Product.avgRating luôn đúng
// ─────────────────────────────────────────────
const syncProductRating = async (productId) => {
  const result = await Review.findOne({
    where:      { productId },
    attributes: [
      [sequelize.fn("AVG", sequelize.col("rating")), "avgRating"],
      [sequelize.fn("COUNT", sequelize.col("id")),   "totalReviews"],
    ],
    raw: true,
  });

  const avg   = result?.avgRating
    ? parseFloat(parseFloat(result.avgRating).toFixed(1))
    : 0;
  const total = result?.totalReviews
    ? parseInt(result.totalReviews)
    : 0;

  await Product.update(
    { avgRating: avg, totalReviews: total },
    { where: { id: productId } }
  );
};

// ─────────────────────────────────────────────
// getReviews({ productId, limit, cursor })
// → { reviews, avgRating, totalReviews, hasMore, nextCursor }
// Cursor-based pagination — load thêm reviews không bị lệch khi có review mới
// ─────────────────────────────────────────────
exports.getReviews = async ({ productId, limit = 10, cursor = null }) => {
  const where = { productId };

  if (cursor) {
    where.createdAt = { [Op.lt]: new Date(parseInt(cursor)) };
  }

  const rows = await Review.findAll({
    where,
    include: [{ model: User, attributes: ["id", "name"] }],
    order:   [["createdAt", "DESC"]],
    limit:   limit + 1, // lấy thêm 1 để biết còn trang tiếp không
  });

  const hasMore    = rows.length > limit;
  const reviews    = hasMore ? rows.slice(0, -1) : rows;
  const nextCursor = hasMore
    ? reviews[reviews.length - 1].createdAt.getTime().toString()
    : null;

  // Lấy avgRating từ Product table — chính xác hơn tính từ page hiện tại
  const product = await Product.findByPk(productId, {
    attributes: ["avgRating", "totalReviews"],
  });

  return {
    reviews,
    avgRating:    product?.avgRating    || 0,
    totalReviews: product?.totalReviews || 0,
    hasMore,
    nextCursor,
  };
};

// ─────────────────────────────────────────────
// createReview({ userId, productId, rating, comment })
// → Review (kèm User)
// Chỉ user đã mua và nhận hàng completed mới được review
// ─────────────────────────────────────────────
exports.createReview = async ({ userId, productId, rating, comment }) => {
  if (!rating || rating < 1 || rating > 5) {
    throw new AppError("Rating phải từ 1 đến 5", 400);
  }

  // Check đã mua và nhận hàng thành công chưa
  const hasPurchased = await Order.findOne({
    where:   { userId, status: "completed" },
    include: [
      {
        model:    OrderItem,
        where:    { productId },
        required: true,
      },
    ],
  });

  if (!hasPurchased) {
    throw new AppError(
      "Bạn cần mua và nhận hàng thành công mới được đánh giá!",
      403
    );
  }

  // Check đã review sản phẩm này chưa
  const existing = await Review.findOne({ where: { userId, productId } });
  if (existing) throw new AppError("Bạn đã đánh giá sản phẩm này rồi!", 400);

  const review = await Review.create({ userId, productId, rating, comment });

  // Sync avgRating + totalReviews lên Product
  await syncProductRating(productId);

  // Trả về kèm thông tin User để FE hiển thị ngay
  return Review.findByPk(review.id, {
    include: [{ model: User, attributes: ["id", "name"] }],
  });
};

// ─────────────────────────────────────────────
// deleteReview({ reviewId, requestUser })
// → void
// Chủ review hoặc admin mới được xóa
// ─────────────────────────────────────────────
exports.deleteReview = async ({ reviewId, requestUser }) => {
  const review = await Review.findByPk(reviewId);
  if (!review) throw new AppError("Review không tồn tại", 404);

  if (review.userId !== requestUser.id && requestUser.role !== "admin") {
    throw new AppError("Không có quyền xóa review này", 403);
  }

  // Lưu lại productId trước khi destroy để sync rating sau
  const { productId } = review;
  await review.destroy();
  await syncProductRating(productId);
};

// ─────────────────────────────────────────────
// replyReview({ reviewId, reply, requestUser })
// → { id, reply, replyAt }
// Admin only
// ─────────────────────────────────────────────
exports.replyReview = async ({ reviewId, reply, requestUser }) => {
  if (requestUser.role !== "admin") {
    throw new AppError("Chỉ admin mới được phản hồi đánh giá!", 403);
  }

  if (!reply || !reply.trim()) {
    throw new AppError("Nội dung trả lời không được để trống!", 400);
  }

  const review = await Review.findByPk(reviewId);
  if (!review) throw new AppError("Review không tồn tại", 404);

  await review.update({
    reply:   reply.trim(),
    replyAt: new Date(),
  });

  return {
    id:      review.id,
    reply:   review.reply,
    replyAt: review.replyAt,
  };
};