const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const crypto  = require("crypto");

const ALLOWED_MIME_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/png":  ".png",
};

const UPLOAD_DIR = path.resolve("src/uploads");

const generateFilename = (ext) =>
  `${Date.now()}-${crypto.randomBytes(16).toString("hex")}${ext}`;

/*
 * Dùng memoryStorage thay vì diskStorage để có thể đọc magic bytes
 * trước khi quyết định lưu file. diskStorage stream thẳng ra disk
 * nên không có cơ hội kiểm tra nội dung thực sự của file.
 */
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Pre-filter sớm bằng mimetype để reject rõ ràng trước khi đọc buffer
    if (!ALLOWED_MIME_TO_EXT[file.mimetype]) {
      return cb(new Error("Only jpg, jpeg, png files are allowed"), false);
    }
    cb(null, true);
  },
});

/*
 * Middleware verify magic bytes và ghi file ra disk.
 * Phải chạy SAU multer vì cần file.buffer đã có trong memory.
 *
 * Magic bytes:
 *   JPEG: FF D8 FF
 *   PNG:  89 50 4E 47 0D 0A 1A 0A
 */
const verifyAndSaveFile = async (req, res, next) => {
  if (!req.file) return next();

  try {
    const { fileTypeFromBuffer } = await import("file-type");
    const detected = await fileTypeFromBuffer(req.file.buffer);

    if (!detected || !ALLOWED_MIME_TO_EXT[detected.mime]) {
      return res.status(400).json({
        status:  "error",
        message: "Only jpg, jpeg, png files are allowed",
        data:    null,
      });
    }

    const ext      = ALLOWED_MIME_TO_EXT[detected.mime];
    const filename = generateFilename(ext);
    const filepath = path.join(UPLOAD_DIR, filename);

    fs.writeFileSync(filepath, req.file.buffer);

    // Ghi đè lại các field để controller dùng giống như diskStorage
    req.file.filename = filename;
    req.file.path     = filepath;
    req.file.mimetype = detected.mime;

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { upload, verifyAndSaveFile };