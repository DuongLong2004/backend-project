


const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ProductPlacement = sequelize.define("ProductPlacement", {
  id:          { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  productId:   { type: DataTypes.INTEGER, allowNull: false },
  placement:   { type: DataTypes.ENUM("homepage", "phones", "laptops", "flashsale"), allowNull: false },
  sortOrder:   { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
  salePrice:   { type: DataTypes.DECIMAL(15, 0), allowNull: true, defaultValue: null },
  saleStartAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  saleEndAt:   { type: DataTypes.DATE, allowNull: true, defaultValue: null },

  // ── Flash Sale stock tracking ──────────────────────────────
  // stockLimit: admin set — tổng suất tối đa. NULL = không giới hạn
  stockLimit:  { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
  // stockSold: hệ thống tự tăng khi có đơn hàng flash sale thành công
  // KHÔNG được update thủ công từ admin — chỉ tăng qua order transaction
  stockSold:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  tableName:  "product_placements",
  timestamps: true,
  indexes: [
    { fields: ["placement"],              name: "idx_placements_placement"          },
    { fields: ["placement", "sortOrder"], name: "idx_placements_placement_sort"     },
    { fields: ["productId", "placement"], name: "idx_placements_product_placement", unique: true },
  ],
});

module.exports = ProductPlacement;