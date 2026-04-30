
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Product = sequelize.define("Product", {
  id:       { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  brand:    { type: DataTypes.STRING, allowNull: false },
  title:    { type: DataTypes.STRING, allowNull: false },
  img:      { type: DataTypes.TEXT },
  category: { type: DataTypes.STRING },
  nation:   { type: DataTypes.STRING },

  // Dùng DECIMAL thay STRING — tránh lỗi tính toán
  price: {
    type: DataTypes.DECIMAL(15, 0),
    allowNull: false,
    defaultValue: 0,
    validate: { min: { args: [0], msg: "Price must be >= 0" } },
  },
  oldPrice: {
    type: DataTypes.DECIMAL(15, 0),
    defaultValue: 0,
  },

  // discount lưu dạng số % thay vì string
  discount: { type: DataTypes.INTEGER, defaultValue: 0 },

  // Thông số kỹ thuật
  display:     { type: DataTypes.STRING },
  screenTech:  { type: DataTypes.STRING },
  ram:         { type: DataTypes.STRING },
  rom:         { type: DataTypes.STRING },
  chip:        { type: DataTypes.STRING },
  camera:      { type: DataTypes.STRING },
  battery:     { type: DataTypes.STRING },
  charging:    { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },

  stock: { type: DataTypes.INTEGER, defaultValue: 50, validate: { min: 0 } },
  sold:  { type: DataTypes.INTEGER, defaultValue: 0,  validate: { min: 0 } },

  // THÊM MỚI: Status — kiểm soát hiển thị sản phẩm
  // "active"     → đang bán, hiện trên ListProduct
  // "draft"      → bản nháp, chỉ admin thấy
  // "outofstock" → hết hàng, admin có thể cho hiện hoặc ẩn
  status: {
    type: DataTypes.ENUM("active", "draft", "outofstock"),
    defaultValue: "active",
    allowNull: false,
  },

  // Rating
  avgRating:    { type: DataTypes.DECIMAL(3, 1), defaultValue: 0 },
  totalReviews: { type: DataTypes.INTEGER,       defaultValue: 0 },

}, {
  tableName: "products",
  timestamps: true,
  indexes: [
    // Giữ nguyên 3 index cũ
    { fields: ["brand"],    name: "idx_products_brand"    },
    { fields: ["category"], name: "idx_products_category" },
    { fields: ["title"],    name: "idx_products_title"    },

    // Giữ nguyên index price
    { fields: ["price"], name: "idx_products_price" },

    // Giữ nguyên composite indexes
    { fields: ["brand", "price"],    name: "idx_products_brand_price"    },
    { fields: ["category", "price"], name: "idx_products_category_price" },

    // THÊM MỚI: index status — query lọc theo status rất nhanh
    { fields: ["status"], name: "idx_products_status" },

    //  THÊM MỚI: composite index status + category
    // Vì ListProduct thường query: WHERE status='active' AND category='phone'
    { fields: ["status", "category"], name: "idx_products_status_category" },
  ],
});

module.exports = Product;