const bcrypt   = require("bcrypt");
const jwt      = require("jsonwebtoken");
const User     = require("../models/User");
const AppError = require("../utils/AppError");
const logger   = require("../utils/logger");
const {
  setRefreshToken,
  getRefreshToken,
  deleteRefreshToken,
} = require("../config/redis");

const generateAccessToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

const generateRefreshToken = (user) =>
  jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

exports.register = async ({ name, email, password }) => {
  if (!name || !email || !password) {
    throw new AppError("Name, email and password are required", 400);
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) throw new AppError("Email already exists", 409);

  const hashed = await bcrypt.hash(password, 10);
  const user   = await User.create({
    name,
    email,
    password: hashed,
    role: "user",
  });

  logger.info(`REGISTER SUCCESS: email=${email}`);

  return {
    id:    user.id,
    name:  user.name,
    email: user.email,
    role:  user.role,
  };
};

exports.login = async ({ email, password, ip }) => {
  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    logger.warn(`AUTH FAIL: Email not found email=${email} ip=${ip}`);
    throw new AppError("Invalid email or password", 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    logger.warn(`AUTH FAIL: Wrong password email=${email} ip=${ip}`);
    throw new AppError("Invalid email or password", 401);
  }

  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  /*
   * Lưu refresh token vào Redis thay vì DB.
   * TTL 7 ngày khớp với JWT expiresIn — token hết hạn sẽ tự bị xóa khỏi Redis.
   * Key: refresh:{userId} — 1 user chỉ có 1 active session tại 1 thời điểm.
   */
  await setRefreshToken(user.id, refreshToken);

  logger.info(`LOGIN SUCCESS: email=${email} ip=${ip}`);

  return {
    accessToken,
    refreshToken,
    user: {
      id:    user.id,
      name:  user.name,
      email: user.email,
      role:  user.role,
    },
  };
};

exports.refresh = async ({ refreshToken }) => {
  if (!refreshToken) {
    throw new AppError("Refresh token is required", 400);
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  /*
   * Verify token có trong Redis không — nếu user đã logout hoặc
   * token bị revoke thì Redis đã DEL key → getRefreshToken trả null.
   */
  const storedToken = await getRefreshToken(decoded.id);
  if (!storedToken || storedToken !== refreshToken) {
    throw new AppError("Refresh token has been revoked", 401);
  }

  const user = await User.findByPk(decoded.id);
  if (!user) throw new AppError("User not found", 401);

  const newAccessToken  = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  // Rotate refresh token — invalidate token cũ, cấp token mới với TTL reset
  await setRefreshToken(user.id, newRefreshToken);

  return {
    accessToken:  newAccessToken,
    refreshToken: newRefreshToken,
  };
};

exports.logout = async ({ refreshToken }) => {
  if (!refreshToken) {
    throw new AppError("Refresh token is required", 400);
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    // Token invalid hoặc expired — vẫn coi như logout thành công
    // vì token đó không thể dùng được nữa
    throw new AppError("Invalid refresh token", 400);
  }

  const storedToken = await getRefreshToken(decoded.id);
  if (!storedToken) {
    throw new AppError("Invalid refresh token", 400);
  }

  await deleteRefreshToken(decoded.id);
  logger.info(`LOGOUT: userId=${decoded.id}`);
};