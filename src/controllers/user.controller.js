const bcrypt = require("bcrypt");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendResponse } = require("../utils/response"); 

/**
 * REGISTER
 */
exports.createUser = catchAsync(async (req, res, next) => {
  const { name, email, password, age } = req.body;

  const existedUser = await User.findOne({ where: { email } });
  if (existedUser) {
    return next(new AppError("Email already exists", 400));
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    age,
    role: "user", // không cho client set role
  });

  return sendResponse(res, 201, "success", "Register successfully", {
    id:    user.id,
    name:  user.name,
    email: user.email,
    age:   user.age,
  });
});

/**
 * GET ALL USERS (ADMIN)
 */
exports.getUsers = catchAsync(async (req, res, next) => {
  const users = await User.findAll({
    attributes: ["id", "name", "email", "age", "role"],
  });

  return sendResponse(res, 200, "success", "OK", users);
});

/**
 * GET USER BY ID
 */
exports.getUserById = catchAsync(async (req, res, next) => {
  const user = await User.findByPk(req.params.id, {
    attributes: ["id", "name", "email", "age", "role"],
  });

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  return sendResponse(res, 200, "success", "OK", user);
});

/**
 * UPDATE USER
 */
exports.updateUser = catchAsync(async (req, res, next) => {
  const user = await User.findByPk(req.params.id);

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // không cho update role & password ở đây
  const { role, password, ...allowedData } = req.body;

  await user.update(allowedData);

  return sendResponse(res, 200, "success", "Update user successfully", {
    id:    user.id,
    name:  user.name,
    email: user.email,
    age:   user.age,
  });
});

/**
 * DELETE USER (ADMIN)
 */
exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByPk(req.params.id);

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  await user.destroy();

  return sendResponse(res, 200, "success", "Delete user successfully");
});

/**
 * CHANGE USER ROLE (ADMIN ONLY)
 */
exports.changeUserRole = catchAsync(async (req, res, next) => {
  const { role } = req.body;

  if (!["user", "admin"].includes(role)) {
    return next(new AppError("Invalid role", 400));
  }

  const user = await User.findByPk(req.params.id);

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // không cho tự đổi role của chính mình
  if (req.user.id === user.id) {
    return next(new AppError("Cannot change your own role", 403));
  }

  user.role = role;
  await user.save();

  return sendResponse(res, 200, "success", "Change role successfully", {
    id:    user.id,
    email: user.email,
    role:  user.role,
  });
});