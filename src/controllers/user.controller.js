

// const bcrypt = require("bcrypt");
// const User = require("../models/User");
// const { sendResponse } = require("../utils/response");

// // REGISTER
// exports.createUser = async (req, res) => {
//   try {
//     const { name, email, password, age } = req.body;

//     if (!name || !email || !password) {
//       return sendResponse(res, 400, "error", "Missing required fields");
//     }

//     const existedUser = await User.findOne({ where: { email } });
//     if (existedUser) {
//       return sendResponse(res, 400, "error", "Email already exists");
//     }

//     // 🔐 HASH PASSWORD
//     const hashedPassword = await bcrypt.hash(password, 10);

//     const user = await User.create({
//       name,
//       email,
//       password: hashedPassword,
//       age,
//       role: "user",
//     });

//     return sendResponse(res, 201, "success", "Register successfully", {
//       id: user.id,
//       name: user.name,
//       email: user.email,
//       age: user.age,
//     });
//   } catch (err) {
//     return sendResponse(res, 500, "error", err.message);
//   }
// };


// // GET ALL USERS
// exports.getUsers = async (req, res) => {
//   try {
//     const users = await User.findAll({
//       attributes: ["id", "name", "email", "age"],
//     });

//     return sendResponse(
//       res,
//       200,
//       "success",
//       "Get users successfully",
//       users
//     );
//   } catch (err) {
//     return sendResponse(
//       res,
//       500,
//       "error",
//       err.message
//     );
//   }
// };

// // GET USER BY ID
// exports.getUserById = async (req, res) => {
//   try {
//     const user = await User.findByPk(req.params.id, {
//       attributes: ["id", "name", "email", "age"],
//     });

//     if (!user) {
//       return sendResponse(
//         res,
//         404,
//         "error",
//         "User not found"
//       );
//     }

//     return sendResponse(
//       res,
//       200,
//       "success",
//       "Get user successfully",
//       user
//     );
//   } catch (err) {
//     return sendResponse(
//       res,
//       500,
//       "error",
//       err.message
//     );
//   }
// };

// // UPDATE USER
// exports.updateUser = async (req, res) => {
//   try {
//     const user = await User.findByPk(req.params.id);

//     if (!user) {
//       return sendResponse(
//         res,
//         404,
//         "error",
//         "User not found"
//       );
//     }

//     await user.update(req.body);

//     return sendResponse(
//       res,
//       200,
//       "success",
//       "Update user successfully",
//       {
//         id: user.id,
//         name: user.name,
//         email: user.email,
//         age: user.age,
//       }
//     );
//   } catch (err) {
//     return sendResponse(
//       res,
//       500,
//       "error",
//       err.message
//     );
//   }
// };

// // DELETE USER
// exports.deleteUser = async (req, res) => {
//   try {
//     const user = await User.findByPk(req.params.id);

//     if (!user) {
//       return sendResponse(
//         res,
//         404,
//         "error",
//         "User not found"
//       );
//     }

//     await user.destroy();

//     return sendResponse(
//       res,
//       200,
//       "success",
//       "Delete user successfully"
//     );
//   } catch (err) {
//     return sendResponse(
//       res,
//       500,
//       "error",
//       err.message
//     );
//   }
// };




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
