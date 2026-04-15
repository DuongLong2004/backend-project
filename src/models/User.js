

// const { DataTypes } = require("sequelize");
// const sequelize = require("../config/db");

// const User = sequelize.define(
//   "User",
//   {
//     id: {
//       type: DataTypes.INTEGER,
//       autoIncrement: true,
//       primaryKey: true,
//     },

//     name: {
//       type: DataTypes.STRING,
//       allowNull: false,
//       validate: {
//         notEmpty: true,
//       },
//     },

//     email: {
//       type: DataTypes.STRING,
//       allowNull: false,
//       unique: true,
//       validate: {
//         isEmail: true,
//       },
//     },

//     password: {
//       type: DataTypes.STRING,
//       allowNull: false,
//     },

//     age: {
//       type: DataTypes.INTEGER,
//       allowNull: true,
//       validate: {
//         min: 0,
//       },
//     },

//     // ✅ THÊM ROLE
//     role: {
//       type: DataTypes.STRING,
//       allowNull: false,
//       defaultValue: "user", // user | admin
//     },
    
//     // Thêm vào sau field "role"
//     refreshToken: {
//       type: DataTypes.TEXT,
//       allowNull: true,
//       defaultValue: null,
//     },

//     avatar: {
//       type: DataTypes.STRING,
//       allowNull: true,
//       defaultValue: null,
//     },
//   },
//   {
//     tableName: "users",
//     timestamps: true,
//   }
// );

// module.exports = User;


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
      unique: true, // ✅ unique tự tạo index — query login/register nhanh
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

    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "user", // user | admin
    },

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
      // ✅ email đã có unique index tự động — không cần thêm
      // ✅ Index refreshToken — dùng khi POST /auth/refresh và POST /auth/logout
      // query: WHERE refreshToken = '...' để tìm user
      { fields: ["refreshToken"], name: "idx_users_refresh_token" },

      // ✅ Index role — dùng khi query danh sách admin
      { fields: ["role"], name: "idx_users_role" },
    ],
  }
);

module.exports = User;
