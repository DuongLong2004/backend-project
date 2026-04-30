const express  = require("express");
const router   = express.Router();
const { upload, verifyAndSaveFile } = require("../middlewares/upload.middleware");
const uploadController = require("../controllers/upload.controller");
const { verifyToken }  = require("../middlewares/auth.middleware");

router.post(
  "/users/avatar",
  verifyToken,
  upload.single("avatar"),
  verifyAndSaveFile,
  uploadController.uploadAvatar
);

router.post(
  "/products/:id/image",
  verifyToken,
  upload.single("image"),
  verifyAndSaveFile,
  uploadController.uploadProductImage
);

module.exports = router;