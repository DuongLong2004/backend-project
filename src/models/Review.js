
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Review = sequelize.define("Review", {
  id:        { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId:    { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  rating:    { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
  comment:   { type: DataTypes.TEXT },

  // ✅ Admin trả lời
  adminReply:   { type: DataTypes.TEXT, defaultValue: null },
  adminReplyAt: { type: DataTypes.DATE, defaultValue: null },

}, {
  tableName: "reviews",
  timestamps: true,
  indexes: [
    { fields: ["productId"] },
    { unique: true, fields: ["userId", "productId"] },
  ]
});

module.exports = Review;