// const { DataTypes } = require("sequelize");
// const sequelize = require("../config/db");

// const Wishlist = sequelize.define("Wishlist", {
//   id:        { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
//   userId:    { type: DataTypes.INTEGER, allowNull: false },
//   productId: { type: DataTypes.INTEGER, allowNull: false },
// }, {
//   tableName: "wishlists",
//   timestamps: true,
//   indexes: [
//     { unique: true, fields: ["userId", "productId"] }, // ✅ không thêm trùng
//   ]
// });

// module.exports = Wishlist;


const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Wishlist = sequelize.define("Wishlist", {
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
}, {
  tableName: "wishlists",
  timestamps: true,
  indexes: [
    // ✅ Index userId — GET /api/wishlist query theo userId
    { fields: ["userId"], name: "idx_wishlist_user_id" },

    // ✅ Unique composite — 1 user không thêm 1 sản phẩm 2 lần
    {
      fields: ["userId", "productId"],
      unique: true,
      name: "idx_wishlist_user_product_unique",
    },
  ],
});

module.exports = Wishlist;