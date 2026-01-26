

// // const express = require("express");
// // const router = express.Router();
// // const controller = require("../controllers/user.controller");
// // const { verifyToken } = require("../middlewares/auth.middleware");

// // // 🔒 PROTECTED
// // router.get("/", verifyToken, controller.getUsers);
// // router.get("/:id", verifyToken, controller.getUserById);
// // router.put("/:id", verifyToken, controller.updateUser);
// // router.delete("/:id", verifyToken, controller.deleteUser);

// // // PUBLIC
// // router.post("/", controller.createUser);

// // module.exports = router;



// const express = require("express");
// const router = express.Router();
// const controller = require("../controllers/user.controller");

// // ✅ SỬA IMPORT ĐÚNG
// const { verifyToken } = require("../middlewares/auth.middleware");
// const checkRole = require("../middlewares/checkRole");

// // 🔒 ADMIN ONLY

// // Chỉ admin được xem danh sách user
// router.get(
//   "/",
//   verifyToken,
//   checkRole("admin"),
//   controller.getUsers
// );

// // Chỉ admin được xoá user
// router.delete(
//   "/:id",
//   verifyToken,
//   checkRole("admin"),
//   controller.deleteUser
// );

// // 🔐 AUTHENTICATED USER

// // User đăng nhập mới xem được thông tin user
// router.get("/:id", verifyToken, controller.getUserById);

// // User đăng nhập mới được update
// router.put("/:id", verifyToken, controller.updateUser);

// // 🌍 PUBLIC

// // Đăng ký
// router.post("/", controller.createUser);

// module.exports = router;



const express = require("express");
const router = express.Router();
const controller = require("../controllers/user.controller");

// 🔐 AUTH
const { verifyToken } = require("../middlewares/auth.middleware");
const checkRole = require("../middlewares/checkRole");

// ✅ VALIDATION
const validate = require("../middlewares/validate.middleware");
const { createUserSchema } = require("../validations/user.validation");

/* ===================== ADMIN ONLY ===================== */

// Admin xem danh sách user
router.get(
  "/",
  verifyToken,
  checkRole("admin"),
  controller.getUsers
);

// Admin xoá user
router.delete(
  "/:id",
  verifyToken,
  checkRole("admin"),
  controller.deleteUser
);

/* ================= AUTHENTICATED USER ================= */

// User đăng nhập mới xem được user
router.get("/:id", verifyToken, controller.getUserById);

// User đăng nhập mới update được
router.put("/:id", verifyToken, controller.updateUser);

/* ====================== PUBLIC ======================== */

// 🔥 Đăng ký (có VALIDATION)
router.post(
  "/",
  validate(createUserSchema),
  controller.createUser
);

module.exports = router;
