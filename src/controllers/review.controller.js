

// const { Review, Order, OrderItem, User, Product } = require("../models/index"); // ✅ thêm Product
// const AppError = require("../utils/AppError");
// const asyncWrapper = require("../utils/asyncWrapper");
// const { sendResponse } = require("../utils/response");

// // ✅ Helper cập nhật avgRating + totalReviews vào Product
// const updateProductRating = async (productId) => {
//   const reviews = await Review.findAll({ where: { productId } });
//   const total   = reviews.length;
//   const avg     = total
//     ? parseFloat((reviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(1))
//     : 0;
//   await Product.update(
//     { avgRating: avg, totalReviews: total },
//     { where: { id: productId } }
//   );
// };

// // GET /api/products/:id/reviews
// exports.getReviews = asyncWrapper(async (req, res, next) => {
//   const { id } = req.params;

//   const reviews = await Review.findAll({
//     where: { productId: id },
//     include: [{ model: User, attributes: ["id", "name"] }],
//     order: [["createdAt", "DESC"]],
//   });

//   const avgRating = reviews.length
//     ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
//     : 0;

//   return sendResponse(res, 200, "success", "OK", {
//     reviews,
//     avgRating:    parseFloat(avgRating),
//     totalReviews: reviews.length,
//   });
// });

// // POST /api/products/:id/reviews
// exports.createReview = asyncWrapper(async (req, res, next) => {
//   const userId    = req.user.id;
//   const productId = parseInt(req.params.id);
//   const { rating, comment } = req.body;

//   if (!rating || rating < 1 || rating > 5) {
//     throw new AppError("Rating phải từ 1 đến 5", 400);
//   }

//   const hasPurchased = await Order.findOne({
//     where: { userId, status: "completed" },
//     include: [{
//       model: OrderItem,
//       where: { productId },
//       required: true,
//     }],
//   });

//   if (!hasPurchased) {
//     throw new AppError("Bạn cần mua và nhận hàng thành công mới được đánh giá!", 403);
//   }

//   const existing = await Review.findOne({ where: { userId, productId } });
//   if (existing) throw new AppError("Bạn đã đánh giá sản phẩm này rồi!", 400);

//   const review = await Review.create({ userId, productId, rating, comment });

//   // ✅ Cập nhật avgRating vào Product
//   await updateProductRating(productId);

//   const result = await Review.findByPk(review.id, {
//     include: [{ model: User, attributes: ["id", "name"] }],
//   });

//   return sendResponse(res, 201, "success", "Đánh giá thành công!", result);
// });

// // DELETE /api/products/:id/reviews/:reviewId
// exports.deleteReview = asyncWrapper(async (req, res, next) => {
//   const userId   = req.user.id;
//   const reviewId = req.params.reviewId;

//   const review = await Review.findByPk(reviewId);
//   if (!review) throw new AppError("Review không tồn tại", 404);

//   if (review.userId !== userId && req.user.role !== "admin") {
//     throw new AppError("Không có quyền xóa review này", 403);
//   }

//   const productId = review.productId;
//   await review.destroy();

//   // ✅ Cập nhật lại avgRating sau khi xóa
//   await updateProductRating(productId);

//   return sendResponse(res, 200, "success", "Đã xóa đánh giá");
// });

// // PATCH /api/products/:id/reviews/:reviewId/reply
// exports.replyReview = asyncWrapper(async (req, res, next) => {
//   const { reply }    = req.body;
//   const { reviewId } = req.params;

//   if (!reply || !reply.trim()) {
//     throw new AppError("Nội dung trả lời không được để trống!", 400);
//   }

//   const review = await Review.findByPk(reviewId);
//   if (!review) throw new AppError("Review không tồn tại", 404);

//   await review.update({
//     adminReply:   reply.trim(),
//     adminReplyAt: new Date(),
//   });

//   return sendResponse(res, 200, "success", "Đã trả lời đánh giá!", {
//     id:           review.id,
//     adminReply:   review.adminReply,
//     adminReplyAt: review.adminReplyAt,
//   });
// });



const { Op } = require("sequelize");
const sequelize = require("../config/db");
const { Review, Order, OrderItem, User, Product } = require("../models/index");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendResponse } = require("../utils/response");

// ─────────────────────────────────────────────
// Helper: cập nhật avgRating + totalReviews
// ✅ Dùng SQL AVG + COUNT thay vì findAll + tính tay
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

  const avg   = result?.avgRating   ? parseFloat(parseFloat(result.avgRating).toFixed(1)) : 0;
  const total = result?.totalReviews ? parseInt(result.totalReviews) : 0;

  await Product.update(
    { avgRating: avg, totalReviews: total },
    { where: { id: productId } }
  );
};

// ─────────────────────────────────────────────
// GET /api/products/:id/reviews
// ─────────────────────────────────────────────
exports.getReviews = catchAsync(async (req, res, next) => {
  const reviews = await Review.findAll({
    where: { productId: req.params.id },
    include: [{ model: User, attributes: ["id", "name"] }],
    order: [["createdAt", "DESC"]],
  });

  const avgRating = reviews.length
    ? parseFloat((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1))
    : 0;

  return sendResponse(res, 200, "success", "OK", {
    reviews,
    avgRating,
    totalReviews: reviews.length,
  });
});

// ─────────────────────────────────────────────
// POST /api/products/:id/reviews
// ─────────────────────────────────────────────
exports.createReview = catchAsync(async (req, res, next) => {
  const userId    = req.user.id;
  const productId = parseInt(req.params.id);
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return next(new AppError("Rating phải từ 1 đến 5", 400));
  }

  // ✅ Kiểm tra đã mua và nhận hàng chưa
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

  // ✅ Kiểm tra đã review chưa
  const existing = await Review.findOne({ where: { userId, productId } });
  if (existing) {
    return next(new AppError("Bạn đã đánh giá sản phẩm này rồi!", 400));
  }

  const review = await Review.create({ userId, productId, rating, comment });

  // ✅ Cập nhật avgRating vào Product
  await updateProductRating(productId);

  const result = await Review.findByPk(review.id, {
    include: [{ model: User, attributes: ["id", "name"] }],
  });

  return sendResponse(res, 201, "success", "Đánh giá thành công!", result);
});

// ─────────────────────────────────────────────
// DELETE /api/products/:id/reviews/:reviewId
// ─────────────────────────────────────────────
exports.deleteReview = catchAsync(async (req, res, next) => {
  const review = await Review.findByPk(req.params.reviewId);
  if (!review) return next(new AppError("Review không tồn tại", 404));

  // ✅ Chỉ chủ review hoặc admin mới được xóa
  if (review.userId !== req.user.id && req.user.role !== "admin") {
    return next(new AppError("Không có quyền xóa review này", 403));
  }

  const productId = review.productId;
  await review.destroy();
  await updateProductRating(productId);

  return sendResponse(res, 200, "success", "Đã xóa đánh giá");
});

// ─────────────────────────────────────────────
// PATCH /api/products/:id/reviews/:reviewId/reply — Admin
// ─────────────────────────────────────────────
exports.replyReview = catchAsync(async (req, res, next) => {
  const { reply } = req.body;

  if (!reply || !reply.trim()) {
    return next(new AppError("Nội dung trả lời không được để trống!", 400));
  }

  const review = await Review.findByPk(req.params.reviewId);
  if (!review) return next(new AppError("Review không tồn tại", 404));

  await review.update({
    adminReply:   reply.trim(),
    adminReplyAt: new Date(),
  });

  return sendResponse(res, 200, "success", "Đã trả lời đánh giá!", {
    id:           review.id,
    adminReply:   review.adminReply,
    adminReplyAt: review.adminReplyAt,
  });
});