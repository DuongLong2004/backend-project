




const bcrypt = require("bcrypt");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

/**
 * REGISTER
 */
exports.createUser = catchAsync(async (req, res, next) => {
  const { name, email, password, age } = req.body;

  const existedUser = await User.findOne({ where: { email } });
  if (existedUser) {
    return next(new AppError("Email already exists", 400));
  }

  // 🔐 HASH PASSWORD
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    age,
    role: "user", // 🔒 không cho client set role
  });

  res.status(201).json({
    status: "success",
    message: "Register successfully",
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      age: user.age,
    },
  });
});

/**
 * GET ALL USERS (ADMIN)
 */
exports.getUsers = catchAsync(async (req, res, next) => {
  const users = await User.findAll({
    attributes: ["id", "name", "email", "age", "role"],
  });

  res.status(200).json({
    status: "success",
    data: users,
  });
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

  res.status(200).json({
    status: "success",
    data: user,
  });
});

/**
 * UPDATE USER
 */
exports.updateUser = catchAsync(async (req, res, next) => {
  const user = await User.findByPk(req.params.id);

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // ❌ không cho update role & password ở đây
  const { role, password, ...allowedData } = req.body;

  await user.update(allowedData);

  res.status(200).json({
    status: "success",
    message: "Update user successfully",
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      age: user.age,
    },
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

  res.status(200).json({
    status: "success",
    message: "Delete user successfully",
  });
});


/**
 * CHANGE USER ROLE (ADMIN ONLY)
 */
exports.changeUserRole = catchAsync(async (req, res, next) => {
  const { role } = req.body;

  // ❗ chỉ cho 2 role hợp lệ
  if (!["user", "admin"].includes(role)) {
    return next(new AppError("Invalid role", 400));
  }

  const user = await User.findByPk(req.params.id);

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // ❌ không cho tự đổi role của chính mình (optional – rất nên có)
  if (req.user.id === user.id) {
    return next(new AppError("Cannot change your own role", 403));
  }

  user.role = role;
  await user.save();

  res.status(200).json({
    status: "success",
    message: "Change role successfully",
    data: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });
});

