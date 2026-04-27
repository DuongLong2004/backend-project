



const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendResponse } = require("../utils/response");
const logger = require("../utils/logger");

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// POST /auth/register
// ─────────────────────────────────────────────
exports.register = catchAsync(async (req, res, next) => {
  const { name, email, password } = req.body;

  // ✅ Check fields TRƯỚC — tránh query DB khi thiếu dữ liệu
  if (!name || !email || !password) {
    return next(new AppError("Name, email and password are required", 400));
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    return next(new AppError("Email already exists", 409));
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hashed,
    role: "user",
  });

  logger.info(`REGISTER SUCCESS: email=${email}`);

  return sendResponse(res, 201, "success", "Registered successfully", {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
});

// ─────────────────────────────────────────────
// POST /auth/login
// ─────────────────────────────────────────────
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // ✅ Check fields TRƯỚC — tránh bcrypt.compare(undefined, hash) gây lỗi 500
  if (!email || !password) {
    return next(new AppError("Email and password are required", 400));
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    logger.warn(`AUTH FAIL: Email not found email=${email} ip=${req.ip}`);
    return next(new AppError("Invalid email or password", 401));
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    logger.warn(`AUTH FAIL: Wrong password email=${email} ip=${req.ip}`);
    return next(new AppError("Invalid email or password", 401));
  }

  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  await user.update({ refreshToken });

  logger.info(`LOGIN SUCCESS: email=${email} ip=${req.ip}`);

  return sendResponse(res, 200, "success", "Login successfully", {
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

// ─────────────────────────────────────────────
// POST /auth/refresh
// ─────────────────────────────────────────────
exports.refresh = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new AppError("Refresh token is required", 400));
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    return next(new AppError("Invalid or expired refresh token", 401));
  }

  const user = await User.findOne({ where: { id: decoded.id, refreshToken } });
  if (!user) {
    return next(new AppError("Refresh token has been revoked", 401));
  }

  const newAccessToken  = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);
  await user.update({ refreshToken: newRefreshToken });

  return sendResponse(res, 200, "success", "Token refreshed", {
    accessToken:  newAccessToken,
    refreshToken: newRefreshToken,
  });
});

// ─────────────────────────────────────────────
// POST /auth/logout
// ─────────────────────────────────────────────
exports.logout = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new AppError("Refresh token is required", 400));
  }

  const user = await User.findOne({ where: { refreshToken } });
  if (!user) {
    return next(new AppError("Invalid refresh token", 400));
  }

  await user.update({ refreshToken: null });

  logger.info(`LOGOUT: userId=${user.id}`);

  return sendResponse(res, 200, "success", "Logged out successfully");
});