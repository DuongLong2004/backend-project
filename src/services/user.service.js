const bcrypt   = require("bcrypt");
const User     = require("../models/User");
const AppError = require("../utils/AppError");

exports.createUser = async ({ name, email, password, age }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) throw new AppError("Email already exists", 400);

  const hashed = await bcrypt.hash(password, 10);
  const user   = await User.create({ name, email, password: hashed, age, role: "user" });

  return { id: user.id, name: user.name, email: user.email, age: user.age };
};

exports.getUsers = async () => {
  return User.findAll({
    attributes: ["id", "name", "email", "age", "role"],
  });
};

exports.getUserById = async (id, requester) => {
  // parseInt vì id từ req.params là string, requester.id từ JWT là number
  if (requester.role !== "admin" && requester.id !== parseInt(id)) {
    throw new AppError("Forbidden", 403);
  }

  const user = await User.findByPk(id, {
    attributes: ["id", "name", "email", "age", "role"],
  });

  if (!user) throw new AppError("User not found", 404);
  return user;
};

exports.updateUser = async (id, body, requester) => {
  // Ownership check — service layer là đúng chỗ để đặt business rule này
  // Controller/route chỉ nên làm nhiệm vụ routing, không chứa authz logic
  if (requester.role !== "admin" && requester.id !== parseInt(id)) {
    throw new AppError("Forbidden", 403);
  }

  const user = await User.findByPk(id);
  if (!user) throw new AppError("User not found", 404);

  // Strip role và password — không cho phép escalate privilege
  // hoặc đổi password qua route này (có route riêng cho đổi password)
  const { role, password, ...allowedData } = body;
  await user.update(allowedData);

  return { id: user.id, name: user.name, email: user.email, age: user.age };
};

exports.deleteUser = async (id) => {
  const user = await User.findByPk(id);
  if (!user) throw new AppError("User not found", 404);
  await user.destroy();
};

exports.changeUserRole = async (targetId, role, requesterId) => {
  if (!["user", "admin"].includes(role)) {
    throw new AppError("Invalid role", 400);
  }

  const user = await User.findByPk(targetId);
  if (!user) throw new AppError("User not found", 404);

  // Không cho tự đổi role của chính mình
  if (requesterId === user.id) {
    throw new AppError("Cannot change your own role", 403);
  }

  user.role = role;
  await user.save();

  return { id: user.id, email: user.email, role: user.role };
};