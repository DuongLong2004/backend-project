


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

// 🔥 ADMIN ĐỔI ROLE USER
router.patch(
  "/:id/role",
  verifyToken,
  checkRole("admin"),
  controller.changeUserRole
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

// User đăng nhập mới update được (KHÔNG role)
router.put("/:id", verifyToken, controller.updateUser);



/* ====================== PUBLIC ======================== */

// 🔥 Đăng ký (có VALIDATION)
router.post(
  "/",
  validate(createUserSchema),
  controller.createUser
);

module.exports = router;
