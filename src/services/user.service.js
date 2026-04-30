const bcrypt   = require("bcrypt");
const User     = require("../models/User");
const AppError = require("../utils/AppError");

// ─────────────────────────────────────────────
// createUser({ name, email, password, age })
// → { id, name, email, age }
// ─────────────────────────────────────────────
exports.createUser = async ({ name, email, password, age }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) throw new AppError("Email already exists", 400);

  const hashed = await bcrypt.hash(password, 10);
  const user   = await User.create({
    name,
    email,
    password: hashed,
    age,
    role: "user", 
  });

  return {
    id:    user.id,
    name:  user.name,
    email: user.email,
    age:   user.age,
  };
};

// ─────────────────────────────────────────────
// getUsers()
// → User[]
// ─────────────────────────────────────────────
exports.getUsers = async () => {
  return User.findAll({
    attributes: ["id", "name", "email", "age", "role"],
  });
};

// ─────────────────────────────────────────────
// getUserById(id)
// → User
// ─────────────────────────────────────────────
exports.getUserById = async (id) => {
  const user = await User.findByPk(id, {
    attributes: ["id", "name", "email", "age", "role"],
  });
  if (!user) throw new AppError("User not found", 404);
  return user;
};

// ─────────────────────────────────────────────
// updateUser(id, body)
// → { id, name, email, age }
// Không cho update role và password qua route này
// ─────────────────────────────────────────────
exports.updateUser = async (id, body) => {
  const user = await User.findByPk(id);
  if (!user) throw new AppError("User not found", 404);

  
  const { role, password, ...allowedData } = body;
  await user.update(allowedData);

  return {
    id:    user.id,
    name:  user.name,
    email: user.email,
    age:   user.age,
  };
};

// ─────────────────────────────────────────────
// deleteUser(id)
// → void
// ─────────────────────────────────────────────
exports.deleteUser = async (id) => {
  const user = await User.findByPk(id);
  if (!user) throw new AppError("User not found", 404);
  await user.destroy();
};

// ─────────────────────────────────────────────
// changeUserRole(targetId, role, requesterId)
// → { id, email, role }
// ─────────────────────────────────────────────
exports.changeUserRole = async (targetId, role, requesterId) => {
  if (!["user", "admin"].includes(role)) {
    throw new AppError("Invalid role", 400);
  }

  const user = await User.findByPk(targetId);
  if (!user) throw new AppError("User not found", 404);

  // Không cho tự đổi role của chính mình — giữ nguyên logic gốc
  if (requesterId === user.id) {
    throw new AppError("Cannot change your own role", 403);
  }

  user.role = role;
  await user.save();

  return {
    id:    user.id,
    email: user.email,
    role:  user.role,
  };
};