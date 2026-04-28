const multer = require("multer");
const path = require("path");
const crypto = require("crypto");


const ALLOWED_MIME_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/jpg":  ".jpg",
  "image/png":  ".png",
};


const generateFilename = (mimetype) => {
  const ext      = ALLOWED_MIME_TO_EXT[mimetype];
  const randomId = crypto.randomBytes(16).toString("hex");
  return `${Date.now()}-${randomId}${ext}`;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "src/uploads/");
  },
  filename: (req, file, cb) => {
    // Extension lấy từ whitelist, KHÔNG lấy từ file.originalname
    cb(null, generateFilename(file.mimetype));
  },
});

const fileFilter = (req, file, cb) => {
  // Check mimetype có trong whitelist không
  if (!ALLOWED_MIME_TO_EXT[file.mimetype]) {
    return cb(new Error("Only jpg, jpeg, png files are allowed"), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // max 2MB
});

module.exports = upload;