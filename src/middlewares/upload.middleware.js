const multer = require("multer");
const path = require("path");

// ✅ Cấu hình lưu file local
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "src/uploads/"); // lưu vào thư mục uploads
  },
  filename: (req, file, cb) => {
    // ✅ Rename file – tránh trùng tên
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// ✅ Validate file type + size
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error("Only jpg, jpeg, png files are allowed"), false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // ✅ max 2MB
});

module.exports = upload;