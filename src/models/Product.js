


// const { DataTypes } = require("sequelize");
// const sequelize = require("../config/db");

// const Product = sequelize.define("Product", {
//   id:          { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
//   brand:       { type: DataTypes.STRING, allowNull: false },
//   title:       { type: DataTypes.STRING, allowNull: false },
//   img:         { type: DataTypes.TEXT },
//   discount:    { type: DataTypes.STRING },
//   price:       { type: DataTypes.STRING },
//   oldPrice:    { type: DataTypes.STRING },
//   category:    { type: DataTypes.STRING },
//   nation:      { type: DataTypes.STRING },
//   display:     { type: DataTypes.STRING },
//   screenTech:  { type: DataTypes.STRING },
//   ram:         { type: DataTypes.STRING },
//   rom:         { type: DataTypes.STRING },
//   chip:        { type: DataTypes.STRING },
//   camera:      { type: DataTypes.STRING },
//   battery:     { type: DataTypes.STRING },
//   charging:    { type: DataTypes.STRING },
//   description: { type: DataTypes.TEXT },
//   stock:       { type: DataTypes.INTEGER, defaultValue: 50 },
//   sold:        { type: DataTypes.INTEGER, defaultValue: 0  },

//   // ✅ Thêm 2 field mới
//   avgRating:    { type: DataTypes.FLOAT,   defaultValue: 0 },
//   totalReviews: { type: DataTypes.INTEGER, defaultValue: 0 },

// }, {
//   tableName: "products",
//   timestamps: true,
//   indexes: [
//     { fields: ["brand"]    },
//     { fields: ["category"] },
//     { fields: ["title"]    },
//   ]
// });

// module.exports = Product;


const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Product = sequelize.define("Product", {
  id:       { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  brand:    { type: DataTypes.STRING, allowNull: false },
  title:    { type: DataTypes.STRING, allowNull: false },
  img:      { type: DataTypes.TEXT },
  category: { type: DataTypes.STRING },
  nation:   { type: DataTypes.STRING },

  // ✅ Dùng DECIMAL thay STRING — tránh lỗi tính toán
  price:    {
    type: DataTypes.DECIMAL(15, 0),
    allowNull: false,
    defaultValue: 0,
    validate: { min: { args: [0], msg: "Price must be >= 0" } },
  },
  oldPrice: {
    type: DataTypes.DECIMAL(15, 0),
    defaultValue: 0,
  },

  // ✅ discount lưu dạng số % thay vì string
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

  // Rating
  avgRating:    { type: DataTypes.DECIMAL(3, 1), defaultValue: 0 },
  totalReviews: { type: DataTypes.INTEGER,       defaultValue: 0 },

}, {
  tableName: "products",
  timestamps: true,
  indexes: [
    { fields: ["brand"]    },
    { fields: ["category"] },
    { fields: ["title"]    },
  ],
});

module.exports = Product;