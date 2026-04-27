


// const { DataTypes } = require("sequelize");
// const sequelize = require("../config/db");

// const Review = sequelize.define("Review", {
//   id: {
//     type: DataTypes.INTEGER,
//     autoIncrement: true,
//     primaryKey: true,
//   },
//   userId: {
//     type: DataTypes.INTEGER,
//     allowNull: false,
//   },
//   productId: {
//     type: DataTypes.INTEGER,
//     allowNull: false,
//   },
//   rating: {
//     type: DataTypes.INTEGER,
//     allowNull: false,
//     validate: { min: 1, max: 5 },
//   },
//   comment: {
//     type: DataTypes.TEXT,
//   },
//   reply: {
//     type: DataTypes.TEXT,
//     defaultValue: null,
//   },
// }, {
//   tableName: "reviews",
//   timestamps: true,
//   indexes: [
//     // ✅ Index productId — GET /api/products/:id/reviews query theo productId
//     { fields: ["productId"], name: "idx_reviews_product_id" },

//     // ✅ Index userId — kiểm tra user đã review chưa
//     { fields: ["userId"], name: "idx_reviews_user_id" },

//     // ✅ Unique composite — 1 user chỉ review 1 sản phẩm 1 lần
//     // Thay cho check thủ công trong controller
//     {
//       fields: ["userId", "productId"],
//       unique: true,
//       name: "idx_reviews_user_product_unique",
//     },
//   ],
// });

// module.exports = Review;


const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Review = sequelize.define("Review", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 5 },
  },
  comment: {
    type: DataTypes.TEXT,
  },
  reply: {
    type: DataTypes.TEXT,
    defaultValue: null,
  },
  // ✅ Thêm replyAt để lưu thời gian admin phản hồi
  replyAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
  },
}, {
  tableName: "reviews",
  timestamps: true,
  indexes: [
    { fields: ["productId"], name: "idx_reviews_product_id" },
    { fields: ["userId"],    name: "idx_reviews_user_id" },
    {
      fields: ["userId", "productId"],
      unique: true,
      name: "idx_reviews_user_product_unique",
    },
  ],
});

module.exports = Review;