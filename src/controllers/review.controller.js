const reviewService    = require("../services/review.service");
const catchAsync       = require("../utils/catchAsync");
const { sendResponse } = require("../utils/response");

// GET /api/products/:id/reviews
exports.getReviews = catchAsync(async (req, res) => {
  const data = await reviewService.getReviews({
    productId: req.params.id,
    limit:     parseInt(req.query.limit) || 10,
    cursor:    req.query.cursor || null,
  });
  return sendResponse(res, 200, "success", "OK", data);
});

// POST /api/products/:id/reviews
exports.createReview = catchAsync(async (req, res) => {
  const data = await reviewService.createReview({
    userId:    req.user.id,
    productId: parseInt(req.params.id),
    rating:    req.body.rating,
    comment:   req.body.comment,
  });
  return sendResponse(res, 201, "success", "Đánh giá thành công!", data);
});

// DELETE /api/products/:id/reviews/:reviewId
exports.deleteReview = catchAsync(async (req, res) => {
  await reviewService.deleteReview({
    reviewId:    req.params.reviewId,
    requestUser: req.user,
  });
  return sendResponse(res, 200, "success", "Đã xóa đánh giá");
});

// PATCH /api/products/:id/reviews/:reviewId/reply
exports.replyReview = catchAsync(async (req, res) => {
  const data = await reviewService.replyReview({
    reviewId:    req.params.reviewId,
    reply:       req.body.reply,
    requestUser: req.user,
  });
  return sendResponse(res, 200, "success", "Đã trả lời đánh giá!", data);
});