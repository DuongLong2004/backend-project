const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload.middleware");
const uploadController = require("../controllers/upload.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

// POST /api/users/avatar
router.post("/users/avatar", verifyToken, upload.single("avatar"), uploadController.uploadAvatar);

// POST /api/products/:id/image
router.post("/products/:id/image", verifyToken, upload.single("image"), uploadController.uploadProductImage);

module.exports = router;