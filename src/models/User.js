const { DataTypes } = require("sequelize");
const sequelize     = require("../config/db");

const User = sequelize.define(
  "User",
  {
    id: {
      type:          DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey:    true,
    },
    name: {
      type:      DataTypes.STRING,
      allowNull: false,
      validate:  { notEmpty: true },
    },
    email: {
      type:      DataTypes.STRING,
      allowNull: false,
      unique:    true,
      validate:  { isEmail: true },
    },
    password: {
      type:      DataTypes.STRING,
      allowNull: false,
    },
    age: {
      type:      DataTypes.INTEGER,
      allowNull: true,
      validate:  { min: 0 },
    },
    role: {
      type:         DataTypes.STRING,
      allowNull:    false,
      defaultValue: "user",
    },
    avatar: {
      type:         DataTypes.STRING,
      allowNull:    true,
      defaultValue: null,
    },
  },
  {
    tableName:  "users",
    timestamps: true,
    indexes: [
      { fields: ["role"], name: "idx_users_role" },
    ],
  }
);

module.exports = User;