


const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, // ✅ unique tự tạo index
      validate: { isEmail: true },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    age: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 },
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "user",
    },
    // ❌ TEXT column không index được trong MySQL
    // Query WHERE refreshToken = ? vẫn hoạt động, chỉ full scan
    // Nếu muốn index: đổi sang DataTypes.STRING(500)
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: "users",
    timestamps: true,
    indexes: [
      // ✅ Chỉ index role — email đã có unique index tự động
      // ❌ Bỏ refreshToken index vì TEXT không index được trong MySQL
      { fields: ["role"], name: "idx_users_role" },
    ],
  }
);

module.exports = User;
