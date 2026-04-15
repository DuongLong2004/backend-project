const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Wishlist = sequelize.define("Wishlist", {
  id:        { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId:    { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: "wishlists",
  timestamps: true,
  indexes: [
    { unique: true, fields: ["userId", "productId"] }, // ✅ không thêm trùng
  ]
});

module.exports = Wishlist;