const bcrypt   = require("bcrypt");
const jwt      = require("jsonwebtoken");
const User     = require("../models/User");
const AppError = require("../utils/AppError");
const logger   = require("../utils/logger");

// ─────────────────────────────────────────────
// Private helpers — chỉ dùng nội bộ service
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
// register({ name, email, password })
// → { id, name, email, role }
// ─────────────────────────────────────────────
exports.register = async ({ name, email, password }) => {
  // Validate — giữ nguyên thứ tự check như controller gốc
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

// ─────────────────────────────────────────────
// login({ email, password, ip })
// → { accessToken, refreshToken, user }
// ─────────────────────────────────────────────
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
  await user.update({ refreshToken });

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

// ─────────────────────────────────────────────
// refresh({ refreshToken })
// → { accessToken, refreshToken }
// ─────────────────────────────────────────────
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

  const user = await User.findOne({ where: { id: decoded.id, refreshToken } });
  if (!user) throw new AppError("Refresh token has been revoked", 401);

  const newAccessToken  = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);
  await user.update({ refreshToken: newRefreshToken });

  return {
    accessToken:  newAccessToken,
    refreshToken: newRefreshToken,
  };
};

// ─────────────────────────────────────────────
// logout({ refreshToken })
// → void
// ─────────────────────────────────────────────
exports.logout = async ({ refreshToken }) => {
  if (!refreshToken) {
    throw new AppError("Refresh token is required", 400);
  }

  const user = await User.findOne({ where: { refreshToken } });
  if (!user) throw new AppError("Invalid refresh token", 400);

  await user.update({ refreshToken: null });
  logger.info(`LOGOUT: userId=${user.id}`);
};