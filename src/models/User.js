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
      unique: true,
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

    
    refreshToken: {
      type: DataTypes.STRING(512),
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
      // index role — dùng cho checkRole middleware
      { fields: ["role"], name: "idx_users_role" },

     
      { fields: ["refreshToken"], name: "idx_users_refresh_token" },
    ],
  }
);

module.exports = User;