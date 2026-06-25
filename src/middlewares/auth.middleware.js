


const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const { client: redis } = require("../config/redis");

// ✅ Dùng next(new AppError()) thay vì sendResponse trực tiếp
// → nhất quán với toàn project, đi qua global error handler
exports.verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("Access token is required", 401));
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ FIX: Check session còn tồn tại trong Redis không
    // Nếu đã logout → session bị xóa → token cũ không dùng được nữa
    const sessionKey = `session:${decoded.id}:${decoded.deviceId}`;
    const session = await redis.get(sessionKey);

    if (!session) {
      return next(new AppError("Session has been terminated", 401));
    }

    req.user = decoded;
    next();
  } catch (err) {
    // ✅ Phân biệt 2 loại lỗi JWT để message rõ ràng hơn
    if (err.name === "TokenExpiredError") {
      return next(new AppError("Token has expired", 401));
    }
    return next(new AppError("Invalid token", 401));
  }
};