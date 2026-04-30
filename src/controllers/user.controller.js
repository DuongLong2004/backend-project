const userService      = require("../services/user.service");
const catchAsync       = require("../utils/catchAsync");
const { sendResponse } = require("../utils/response");

// POST /api/users
exports.createUser = catchAsync(async (req, res) => {
  const data = await userService.createUser(req.body);
  return sendResponse(res, 201, "success", "Register successfully", data);
});

// GET /api/users  (admin)
exports.getUsers = catchAsync(async (req, res) => {
  const data = await userService.getUsers();
  return sendResponse(res, 200, "success", "OK", data);
});

// GET /api/users/:id
exports.getUserById = catchAsync(async (req, res) => {
  const data = await userService.getUserById(req.params.id);
  return sendResponse(res, 200, "success", "OK", data);
});

// PUT /api/users/:id
exports.updateUser = catchAsync(async (req, res) => {
  const data = await userService.updateUser(req.params.id, req.body);
  return sendResponse(res, 200, "success", "Update user successfully", data);
});

// DELETE /api/users/:id  (admin)
exports.deleteUser = catchAsync(async (req, res) => {
  await userService.deleteUser(req.params.id);
  return sendResponse(res, 200, "success", "Delete user successfully");
});

// PATCH /api/users/:id/role  (admin)
exports.changeUserRole = catchAsync(async (req, res) => {
  const data = await userService.changeUserRole(
    req.params.id,   // targetId
    req.body.role,   // role mới
    req.user.id      // requesterId — để check không tự đổi mình
  );
  return sendResponse(res, 200, "success", "Change role successfully", data);
});