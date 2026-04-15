const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/wishlist.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

router.get("/",              verifyToken, ctrl.getWishlist);
router.get("/ids",           verifyToken, ctrl.getWishlistIds);
router.post("/:productId",   verifyToken, ctrl.addWishlist);
router.delete("/:productId", verifyToken, ctrl.removeWishlist);

module.exports = router;