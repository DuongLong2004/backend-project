


// // const { Op } = require("sequelize");
// // const sequelize = require("../config/db");
// // const { Review, Order, OrderItem, User, Product } = require("../models/index");
// // const AppError = require("../utils/AppError");
// // const catchAsync = require("../utils/catchAsync");
// // const { sendResponse } = require("../utils/response");

// // // ─────────────────────────────────────────────
// // // Helper: cập nhật avgRating + totalReviews
// // // ✅ Dùng SQL AVG + COUNT thay vì findAll + tính tay
// // // ─────────────────────────────────────────────
// // const updateProductRating = async (productId) => {
// //   const result = await Review.findOne({
// //     where: { productId },
// //     attributes: [
// //       [sequelize.fn("AVG", sequelize.col("rating")), "avgRating"],
// //       [sequelize.fn("COUNT", sequelize.col("id")),   "totalReviews"],
// //     ],
// //     raw: true,
// //   });

// //   const avg   = result?.avgRating    ? parseFloat(parseFloat(result.avgRating).toFixed(1)) : 0;
// //   const total = result?.totalReviews ? parseInt(result.totalReviews) : 0;

// //   await Product.update(
// //     { avgRating: avg, totalReviews: total },
// //     { where: { id: productId } }
// //   );
// // };

// // // ─────────────────────────────────────────────
// // // GET /api/products/:id/reviews
// // // ✅ Cursor-based pagination — phù hợp cho infinite scroll reviews
// // // Dùng createdAt làm cursor thay vì OFFSET
// // // Tại sao: sản phẩm hot có hàng nghìn reviews — OFFSET lớn = chậm
// // //
// // // Cách dùng:
// // //   Lần đầu: GET /api/products/:id/reviews?limit=10
// // //   Trang tiếp: GET /api/products/:id/reviews?cursor=<nextCursor>&limit=10
// // // ─────────────────────────────────────────────
// // exports.getReviews = catchAsync(async (req, res, next) => {
// //   const productId = req.params.id;
// //   const limit     = parseInt(req.query.limit) || 10;
// //   const cursor    = req.query.cursor || null;

// //   const where = { productId };

// //   // ✅ Nếu có cursor → chỉ lấy reviews cũ hơn cursor đó
// //   if (cursor) {
// //     where.createdAt = { [Op.lt]: new Date(parseInt(cursor)) };
// //   }

// //   // ✅ Lấy thêm 1 để biết còn trang tiếp không
// //   const reviews = await Review.findAll({
// //     where,
// //     include: [{ model: User, attributes: ["id", "name"] }],
// //     order: [["createdAt", "DESC"]],
// //     limit: limit + 1,
// //   });

// //   // ✅ Kiểm tra hasMore
// //   const hasMore = reviews.length > limit;
// //   const data    = hasMore ? reviews.slice(0, -1) : reviews;

// //   // ✅ nextCursor = timestamp của review cuối
// //   const nextCursor = hasMore
// //     ? data[data.length - 1].createdAt.getTime().toString()
// //     : null;

// //   // ✅ Tính avgRating từ data hiện tại (lần đầu load)
// //   // Nếu có cursor (load more) → dùng avgRating từ Product table sẽ chính xác hơn
// //   const avgRating = data.length
// //     ? parseFloat((data.reduce((sum, r) => sum + r.rating, 0) / data.length).toFixed(1))
// //     : 0;

// //   return sendResponse(res, 200, "success", "OK", {
// //     reviews: data,
// //     avgRating,
// //     totalReviews: data.length,
// //     hasMore,
// //     nextCursor,
// //   });
// // });

// // // ─────────────────────────────────────────────
// // // POST /api/products/:id/reviews
// // // ─────────────────────────────────────────────
// // exports.createReview = catchAsync(async (req, res, next) => {
// //   const userId    = req.user.id;
// //   const productId = parseInt(req.params.id);
// //   const { rating, comment } = req.body;

// //   if (!rating || rating < 1 || rating > 5) {
// //     return next(new AppError("Rating phải từ 1 đến 5", 400));
// //   }

// //   // ✅ Kiểm tra đã mua và nhận hàng chưa
// //   const hasPurchased = await Order.findOne({
// //     where: { userId, status: "completed" },
// //     include: [{
// //       model: OrderItem,
// //       where: { productId },
// //       required: true,
// //     }],
// //   });

// //   if (!hasPurchased) {
// //     return next(new AppError("Bạn cần mua và nhận hàng thành công mới được đánh giá!", 403));
// //   }

// //   // ✅ Kiểm tra đã review chưa
// //   const existing = await Review.findOne({ where: { userId, productId } });
// //   if (existing) {
// //     return next(new AppError("Bạn đã đánh giá sản phẩm này rồi!", 400));
// //   }

// //   const review = await Review.create({ userId, productId, rating, comment });

// //   // ✅ Cập nhật avgRating vào Product
// //   await updateProductRating(productId);

// //   const result = await Review.findByPk(review.id, {
// //     include: [{ model: User, attributes: ["id", "name"] }],
// //   });

// //   return sendResponse(res, 201, "success", "Đánh giá thành công!", result);
// // });

// // // ─────────────────────────────────────────────
// // // DELETE /api/products/:id/reviews/:reviewId
// // // ─────────────────────────────────────────────
// // exports.deleteReview = catchAsync(async (req, res, next) => {
// //   const review = await Review.findByPk(req.params.reviewId);
// //   if (!review) return next(new AppError("Review không tồn tại", 404));

// //   // ✅ Chỉ chủ review hoặc admin mới được xóa
// //   if (review.userId !== req.user.id && req.user.role !== "admin") {
// //     return next(new AppError("Không có quyền xóa review này", 403));
// //   }

// //   const productId = review.productId;
// //   await review.destroy();
// //   await updateProductRating(productId);

// //   return sendResponse(res, 200, "success", "Đã xóa đánh giá");
// // });

// // // ─────────────────────────────────────────────
// // // PATCH /api/products/:id/reviews/:reviewId/reply — Admin
// // // ─────────────────────────────────────────────
// // exports.replyReview = catchAsync(async (req, res, next) => {
// //   const { reply } = req.body;

// //   if (!reply || !reply.trim()) {
// //     return next(new AppError("Nội dung trả lời không được để trống!", 400));
// //   }

// //   const review = await Review.findByPk(req.params.reviewId);
// //   if (!review) return next(new AppError("Review không tồn tại", 404));

// //   await review.update({
// //     adminReply:   reply.trim(),
// //     adminReplyAt: new Date(),
// //   });

// //   return sendResponse(res, 200, "success", "Đã trả lời đánh giá!", {
// //     id:           review.id,
// //     adminReply:   review.adminReply,
// //     adminReplyAt: review.adminReplyAt,
// //   });
// // });



// const { Op } = require("sequelize");
// const sequelize = require("../config/db");
// const { Review, Order, OrderItem, User, Product } = require("../models/index");
// const AppError = require("../utils/AppError");
// const catchAsync = require("../utils/catchAsync");
// const { sendResponse } = require("../utils/response");

// // ─────────────────────────────────────────────
// // Helper: cập nhật avgRating + totalReviews
// // ─────────────────────────────────────────────
// const updateProductRating = async (productId) => {
//   const result = await Review.findOne({
//     where: { productId },
//     attributes: [
//       [sequelize.fn("AVG", sequelize.col("rating")), "avgRating"],
//       [sequelize.fn("COUNT", sequelize.col("id")),   "totalReviews"],
//     ],
//     raw: true,
//   });

//   const avg   = result?.avgRating    ? parseFloat(parseFloat(result.avgRating).toFixed(1)) : 0;
//   const total = result?.totalReviews ? parseInt(result.totalReviews) : 0;

//   await Product.update(
//     { avgRating: avg, totalReviews: total },
//     { where: { id: productId } }
//   );
// };

// // ─────────────────────────────────────────────
// // GET /api/products/:id/reviews
// // ─────────────────────────────────────────────
// exports.getReviews = catchAsync(async (req, res, next) => {
//   const productId = req.params.id;
//   const limit     = parseInt(req.query.limit) || 10;
//   const cursor    = req.query.cursor || null;

//   const where = { productId };

//   if (cursor) {
//     where.createdAt = { [Op.lt]: new Date(parseInt(cursor)) };
//   }

//   const reviews = await Review.findAll({
//     where,
//     // ✅ Thêm adminReply + adminReplyAt vào attributes
//     attributes: [
//       "id", "userId", "productId",
//       "rating", "comment",
//       "adminReply", "adminReplyAt",   // ← quan trọng
//       "createdAt", "updatedAt",
//     ],
//     include: [{ model: User, attributes: ["id", "name"] }],
//     order: [["createdAt", "DESC"]],
//     limit: limit + 1,
//   });

//   const hasMore = reviews.length > limit;
//   const data    = hasMore ? reviews.slice(0, -1) : reviews;

//   const nextCursor = hasMore
//     ? data[data.length - 1].createdAt.getTime().toString()
//     : null;

//   // ✅ Lấy avgRating từ Product table — chính xác hơn tính từ page hiện tại
//   const product = await Product.findByPk(productId, {
//     attributes: ["avgRating", "totalReviews"],
//   });

//   return sendResponse(res, 200, "success", "OK", {
//     reviews: data,
//     avgRating:    product?.avgRating    || 0,
//     totalReviews: product?.totalReviews || 0,
//     hasMore,
//     nextCursor,
//   });
// });

// // ─────────────────────────────────────────────
// // POST /api/products/:id/reviews
// // ─────────────────────────────────────────────
// exports.createReview = catchAsync(async (req, res, next) => {
//   const userId    = req.user.id;
//   const productId = parseInt(req.params.id);
//   const { rating, comment } = req.body;

//   if (!rating || rating < 1 || rating > 5) {
//     return next(new AppError("Rating phải từ 1 đến 5", 400));
//   }

//   // ✅ Kiểm tra đã mua và nhận hàng chưa
//   const hasPurchased = await Order.findOne({
//     where: { userId, status: "completed" },
//     include: [{
//       model: OrderItem,
//       where: { productId },
//       required: true,
//     }],
//   });

//   if (!hasPurchased) {
//     return next(new AppError("Bạn cần mua và nhận hàng thành công mới được đánh giá!", 403));
//   }

//   // ✅ Kiểm tra đã review chưa
//   const existing = await Review.findOne({ where: { userId, productId } });
//   if (existing) {
//     return next(new AppError("Bạn đã đánh giá sản phẩm này rồi!", 400));
//   }

//   const review = await Review.create({ userId, productId, rating, comment });
//   await updateProductRating(productId);

//   const result = await Review.findByPk(review.id, {
//     attributes: ["id", "userId", "productId", "rating", "comment", "adminReply", "adminReplyAt", "createdAt", "updatedAt"],
//     include: [{ model: User, attributes: ["id", "name"] }],
//   });

//   return sendResponse(res, 201, "success", "Đánh giá thành công!", result);
// });

// // ─────────────────────────────────────────────
// // DELETE /api/products/:id/reviews/:reviewId
// // ─────────────────────────────────────────────
// exports.deleteReview = catchAsync(async (req, res, next) => {
//   const review = await Review.findByPk(req.params.reviewId);
//   if (!review) return next(new AppError("Review không tồn tại", 404));

//   if (review.userId !== req.user.id && req.user.role !== "admin") {
//     return next(new AppError("Không có quyền xóa review này", 403));
//   }

//   const productId = review.productId;
//   await review.destroy();
//   await updateProductRating(productId);

//   return sendResponse(res, 200, "success", "Đã xóa đánh giá");
// });

// // ─────────────────────────────────────────────
// // PATCH /api/products/:id/reviews/:reviewId/reply
// // ─────────────────────────────────────────────
// exports.replyReview = catchAsync(async (req, res, next) => {
//   if (req.user.role !== "admin") {
//     return next(new AppError("Chỉ admin mới được phản hồi đánh giá!", 403));
//   }

//   const { reply } = req.body;
//   if (!reply || !reply.trim()) {
//     return next(new AppError("Nội dung trả lời không được để trống!", 400));
//   }

//   const review = await Review.findByPk(req.params.reviewId);
//   if (!review) return next(new AppError("Review không tồn tại", 404));

//   await review.update({
//     adminReply:   reply.trim(),
//     adminReplyAt: new Date(),
//   });

//   // ✅ Trả về đầy đủ để frontend sync
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
    // attributes không khai báo → Sequelize lấy tất cả cột trong bảng
    // Sau khi DB có cột adminReply rồi, sẽ tự include
    include: [{ model: User, attributes: ["id", "name"] }],
    order: [["createdAt", "DESC"]],
    limit: limit + 1,
  });

  const hasMore = reviews.length > limit;
  const data    = hasMore ? reviews.slice(0, -1) : reviews;

  const nextCursor = hasMore
    ? data[data.length - 1].createdAt.getTime().toString()
    : null;

  // ✅ Lấy avgRating từ Product table — chính xác hơn tính từ page hiện tại
  const product = await Product.findByPk(productId, {
    attributes: ["avgRating", "totalReviews"],
  });

  return sendResponse(res, 200, "success", "OK", {
    reviews: data,
    avgRating:    product?.avgRating    || 0,
    totalReviews: product?.totalReviews || 0,
    hasMore,
    nextCursor,
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

  // ✅ Trả về đầy đủ để frontend sync
  return sendResponse(res, 200, "success", "Đã trả lời đánh giá!", {
    id:      review.id,
    reply:   review.reply,
    replyAt: review.replyAt,
  });
});