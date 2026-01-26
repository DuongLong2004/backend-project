const jwt = require("jsonwebtoken");
const { sendResponse } = require("../utils/response");

exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // ❌ Không có token
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendResponse(res, 401, "error", "Access token is required");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Gắn user vào request
    req.user = decoded;

    next();
  } catch (err) {
    return sendResponse(res, 401, "error", "Invalid or expired token");
  }
};
