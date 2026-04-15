const express = require("express");
const router = express.Router({ mergeParams: true });
const reviewController = require("../controllers/review.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const checkRole = require("../middlewares/checkRole");

// GET – Public
router.get("/", reviewController.getReviews);

// POST – Cần login
router.post("/", verifyToken, reviewController.createReview);

// PATCH – Admin trả lời ✅
router.patch("/:reviewId/reply", verifyToken, checkRole("admin"), reviewController.replyReview);

// DELETE – Chủ review hoặc admin
router.delete("/:reviewId", verifyToken, reviewController.deleteReview);

module.exports = router;