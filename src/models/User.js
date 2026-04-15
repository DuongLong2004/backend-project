

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
      validate: {
        notEmpty: true,
      },
    },

    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },

    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    age: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0,
      },
    },

    // ✅ THÊM ROLE
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "user", // user | admin
    },
    
    // Thêm vào sau field "role"
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
  }
);

module.exports = User;

