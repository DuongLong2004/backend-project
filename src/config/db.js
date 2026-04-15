// const { Sequelize } = require("sequelize");

// const sequelize = new Sequelize(
//   process.env.DB_NAME,
//   process.env.DB_USER,
//   process.env.DB_PASSWORD,
//   {
//     host: process.env.DB_HOST,
//     port: process.env.DB_PORT,
//     dialect: "mysql",
//     logging: false,
//   }
// );

// module.exports = sequelize;


const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host:    process.env.DB_HOST,
    port:    process.env.DB_PORT || 3306,
    dialect: "mysql",

    // ✅ Tắt log SQL trong production, bật trong development
    logging: process.env.NODE_ENV === "development" ? console.log : false,

    // ✅ Timezone — quan trọng khi deploy lên server nước ngoài
    timezone: "+07:00",

    // ✅ Connection pool — tránh quá tải kết nối DB
    pool: {
      max: 10,     // tối đa 10 connections cùng lúc
      min: 0,      // tối thiểu 0 khi idle
      acquire: 30000, // chờ tối đa 30s để lấy connection
      idle: 10000,    // đóng connection sau 10s không dùng
    },

    // ✅ Tự động retry khi mất kết nối
    retry: {
      max: 3,
    },
  }
);

module.exports = sequelize;