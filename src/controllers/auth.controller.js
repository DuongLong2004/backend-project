const authService      = require("../services/auth.service");
const catchAsync       = require("../utils/catchAsync");
const { sendResponse } = require("../utils/response");

// POST /api/auth/register
exports.register = catchAsync(async (req, res) => {
  const data = await authService.register(req.body);
  return sendResponse(res, 201, "success", "Registered successfully", data);
});

// POST /api/auth/login
exports.login = catchAsync(async (req, res) => {
  const data = await authService.login({
    email:    req.body.email,
    password: req.body.password,
    ip:       req.ip,           // ip giữ nguyên như controller gốc
  });
  return sendResponse(res, 200, "success", "Login successfully", data);
});

// POST /api/auth/refresh
exports.refresh = catchAsync(async (req, res) => {
  const data = await authService.refresh({
    refreshToken: req.body.refreshToken,
  });
  return sendResponse(res, 200, "success", "Token refreshed", data);
});

// POST /api/auth/logout
exports.logout = catchAsync(async (req, res) => {
  await authService.logout({
    refreshToken: req.body.refreshToken,
  });
  return sendResponse(res, 200, "success", "Logged out successfully");
});